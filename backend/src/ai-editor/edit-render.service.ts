import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { writeFile, stat, copyFile } from 'node:fs/promises';
import { join } from 'node:path';
import { R2Service } from '../storage/r2.service';
import { MediaInspectionService } from '../media/services/media-inspection.service';
import { ProcessRegistryService } from '../common/services/process-registry.service';
import { runCommandWithProgress } from '../media/utils/run-command-with-progress';
import { assertNotCancelled } from '../jobs/cancellation-context';
import { EditPlanValidatorService } from './edit-plan-validator.service';
import type { EditVersion } from './edit.schemas';
import { buildRenderSpec, LocalMedia } from './ffmpeg-edit-renderer';

@Injectable()
export class EditRenderService {
  constructor(
    private r2: R2Service,
    private inspection: MediaInspectionService,
    private registry: ProcessRegistryService,
    private validator: EditPlanValidatorService,
    private config: ConfigService,
  ) {}
  private async inspectMedia(path: string, format?: string) {
    try {
      return await this.inspection.inspect(path, true, format);
    } catch (error) {
      assertNotCancelled();
      if (error instanceof Error && /ENOENT|timed out/i.test(error.message))
        throw error;
      throw new BadRequestException(
        'Media is corrupted or uses an unsupported container',
      );
    }
  }
  async render(
    version: EditVersion,
    directory: string,
    onProgress: (value: number) => void,
  ) {
    const validated = await this.validator.validate(
      version.userId,
      version.plan,
      version.sourceMedia.duration,
    );
    const sourceInfo = await this.r2.objectInfo(version.sourceMedia.storageKey);
    const maxBytes = Number(
      this.config.get('EDIT_SOURCE_MAX_BYTES', 500 * 1024 * 1024),
    );
    if (
      !Number.isFinite(maxBytes) ||
      maxBytes <= 0 ||
      !sourceInfo.size ||
      sourceInfo.size > maxBytes
    )
      throw new BadRequestException('Source exceeds editing storage budget');
    const sourcePath = join(directory, 'source.mp4');
    await this.r2.downloadToLocal(version.sourceMedia.storageKey, sourcePath, {
      maxBytes,
      etag: version.sourceMedia.etag,
    });
    const sourceProbe = await this.inspectMedia(sourcePath, 'mov');
    if (
      !sourceProbe.hasVideo ||
      Math.abs(sourceProbe.durationSeconds - version.sourceMedia.duration) > 0.2
    )
      throw new BadRequestException(
        'Source metadata changed or video stream is missing',
      );
    if (
      !sourceProbe.width ||
      !sourceProbe.height ||
      sourceProbe.width * sourceProbe.height > 8_294_400
    )
      throw new BadRequestException(
        'Source dimensions exceed the decoding budget',
      );
    const source = {
      ...sourceProbe,
      duration: sourceProbe.durationSeconds,
      path: sourcePath,
    };
    const assets = new Map<string, LocalMedia>();
    for (const [id, asset] of validated.media) {
      assertNotCancelled();
      const path = join(
        directory,
        `asset-${assets.size}${asset.kind === 'image' ? '.png' : '.audio'}`,
      );
      const expected =
        version.assetEtags instanceof Map
          ? (version.assetEtags as Map<string, string>).get(id)
          : version.assetEtags?.[id];
      if (expected && asset.etag !== expected)
        throw new BadRequestException('Editing asset changed after submission');
      const format =
        asset.kind === 'image'
          ? 'png_pipe'
          : (
              {
                'audio/mpeg': 'mp3',
                'audio/wav': 'wav',
                'audio/x-wav': 'wav',
                'audio/mp4': 'mov',
                'audio/ogg': 'ogg',
              } as Record<string, string>
            )[asset.mimeType];
      await this.r2.downloadToLocal(asset.storageKey, path, {
        maxBytes: 100 * 1024 * 1024,
        etag: expected ?? asset.etag,
      });
      const metadata = await this.inspectMedia(path, format);
      if (
        asset.kind === 'audio' &&
        (!metadata.hasAudio ||
          metadata.hasVideo ||
          validated.plan.audio.tracks.some(
            (t) =>
              t.enabled &&
              t.assetId === id &&
              t.sourceEnd > metadata.durationSeconds + 0.01,
          ))
      )
        throw new BadRequestException(
          'Audio asset has an invalid stream or trim range',
        );
      if (
        asset.kind === 'image' &&
        (!metadata.hasVideo ||
          metadata.codec !== 'png' ||
          !metadata.width ||
          !metadata.height ||
          metadata.width * metadata.height > 4_000_000)
      )
        throw new BadRequestException('Image dimensions exceed render budget');
      assets.set(id, {
        ...metadata,
        duration: metadata.durationSeconds,
        path,
        format,
      });
    }
    // Fail explicitly if approved fonts are unavailable; never substitute emoji/system fonts.
    const defaults =
      process.platform === 'win32'
        ? {
            sans: 'C:/Windows/Fonts/arial.ttf',
            serif: 'C:/Windows/Fonts/times.ttf',
            mono: 'C:/Windows/Fonts/cour.ttf',
          }
        : {
            sans: '/usr/share/fonts/truetype/liberation2/LiberationSans-Regular.ttf',
            serif:
              '/usr/share/fonts/truetype/liberation2/LiberationSerif-Regular.ttf',
            mono: '/usr/share/fonts/truetype/liberation2/LiberationMono-Regular.ttf',
          };
    const fontFiles: Record<string, string> = {};
    const fonts = new Set(
      validated.plan.operations
        .flatMap((o) =>
          o.enabled && o.type === 'text_overlay' ? [o.params.font] : [],
        )
        .concat(
          validated.plan.captions
            .filter((c) => c.visible && c.burnIn)
            .map((c) => c.style.font),
        ),
    );
    for (const font of fonts) {
      fontFiles[font] = 'font-' + font + '.ttf';
      await copyFile(
        this.config.get<string>(
          'EDIT_FONT_' + font.toUpperCase(),
          defaults[font],
        ),
        join(directory, fontFiles[font]),
      );
    }
    // Conservative buffer estimate for concurrent branches reading one source.
    const ranges = validated.timeline.segments.map((s) =>
      s.type === 'video'
        ? { start: s.sourceStart, end: s.sourceEnd }
        : {
            start: s.sourceTime,
            end: s.sourceTime + 1 / validated.plan.video.fps,
          },
    );
    const sourceSpan =
      Math.max(...ranges.map((s) => s.end)) -
      Math.min(...ranges.map((s) => s.start));
    const queuedFrames =
      validated.timeline.segments.length > 1
        ? Math.max(
            sourceSpan,
            validated.timeline.segments.reduce((n, s) => n + s.length, 0),
          ) *
          validated.plan.video.fps *
          validated.timeline.segments.length
        : 0;
    const bufferEstimate = queuedFrames * source.width! * source.height! * 1.5;
    if (bufferEstimate > 256 * 1024 * 1024)
      throw new BadRequestException(
        'Segment buffering exceeds the 256 MiB preview budget; shorten or split this edit',
      );
    let spec: ReturnType<typeof buildRenderSpec>;
    try {
      spec = buildRenderSpec(validated.plan, source, assets, directory, {
        relativeTextPaths: true,
        fontFiles,
      });
    } catch {
      throw new BadRequestException(
        'Edit cannot fit the preview canvas; check crop dimensions and text length',
      );
    }
    const outputMaxBytes = Number(
      this.config.get('EDIT_OUTPUT_MAX_BYTES', 200 * 1024 * 1024),
    );
    if (
      !Number.isSafeInteger(outputMaxBytes) ||
      outputMaxBytes < 1024 * 1024 ||
      outputMaxBytes > 1024 * 1024 * 1024
    )
      throw new Error('Invalid editing output budget');
    spec.args.splice(spec.args.length - 1, 0, '-fs', String(outputMaxBytes));
    await writeFile(join(directory, 'filters.txt'), spec.filters);
    for (const file of spec.textFiles)
      await writeFile(file.path, file.text, 'utf8');
    await runCommandWithProgress(
      'ffmpeg',
      spec.args,
      (line) => {
        if (line.startsWith('out_time_us=')) {
          const elapsed = Number(line.slice('out_time_us='.length)) / 1e6;
          if (Number.isFinite(elapsed))
            onProgress(
              Math.min(
                95,
                Math.max(1, Math.round((elapsed / spec.duration) * 95)),
              ),
            );
        }
      },
      this.registry,
      { cwd: directory },
    );
    assertNotCancelled();
    const outputPath = join(directory, 'output.mp4');
    const probe = await this.inspection.inspect(outputPath, true);
    if (
      !(await stat(outputPath)).size ||
      (await stat(outputPath)).size > outputMaxBytes ||
      !probe.hasVideo ||
      !probe.hasAudio ||
      probe.width !== spec.width ||
      probe.height !== spec.height ||
      Math.abs(probe.durationSeconds - spec.duration) >
        Math.max(0.15, 2 / validated.plan.video.fps) ||
      Math.abs((probe.fps ?? 0) - validated.plan.video.fps) > 0.1
    )
      throw new Error('Rendered output failed media verification');
    await runCommandWithProgress(
      'ffmpeg',
      [
        '-v',
        'error',
        '-xerror',
        '-protocol_whitelist',
        'file,pipe',
        '-f',
        'mov',
        '-i',
        outputPath,
        '-map',
        '0:v:0',
        '-map',
        '0:a:0',
        '-f',
        'null',
        '-',
      ],
      () => undefined,
      this.registry,
    );
    return {
      outputPath,
      bytes: (await stat(outputPath)).size,
      duration: spec.duration,
      width: spec.width,
      height: spec.height,
    };
  }
}
