import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { copyFile, mkdtemp, rm, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { ConfigService } from '@nestjs/config';
import { runRenderer } from './renderer';
import { resolveStylePreset } from '../media/style-presets';

const exec = promisify(execFile);
const integration =
  process.env.EDIT_FFMPEG_PATH && process.env.EDIT_FFPROBE_PATH
    ? describe
    : describe.skip;
integration(
  'one-shot real FFmpeg rendering (local R2 transport fixture)',
  () => {
    let directory: string;
    let source: string;
    beforeAll(async () => {
      directory = await mkdtemp(join(tmpdir(), 'blynta-batch-media-test-'));
      source = join(directory, 'source.mp4');
      await exec(process.env.EDIT_FFMPEG_PATH!, [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=blue:size=160x90:rate=24:duration=1',
        '-f',
        'lavfi',
        '-i',
        'sine=frequency=440:duration=1',
        '-c:v',
        'libx264',
        '-threads',
        '1',
        '-c:a',
        'aac',
        source,
      ]);
    }, 30000);
    afterAll(async () => {
      await rm(directory, { recursive: true, force: true });
    });
    it.each([
      ['blynta', 'blynta', false],
      ['blynta', 'blynta', true],
      ['output', 'private', false],
      ['output', 'private', true],
    ] as const)(
      'cuts, crops, retains audio and verifies output; buckets=%s/%s captions=%s',
      async (outputBucket, sourceBucket, captions) => {
        const prefix = `job-sources/batch/${'b'.repeat(64)}`;
        const task = {
          version: 1,
          kind: 'clip',
          sourceKey: 'source-videos/fixture/source.mp4',
          start: 0.1,
          end: 0.6,
          segments: captions
            ? [{ startTime: 0, endTime: 0.4, text: 'Batch captions' }]
            : [],
          style: resolveStylePreset('default').captionStyle,
          deadline: Date.now() + 60000,
          outputKey: `${prefix}/output.mp4`,
        };
        const output = join(directory, captions ? 'captioned.mp4' : 'raw.mp4');
        const markers: { key: string; value: unknown }[] = [];
        const r2 = {
          downloadToBuffer: () =>
            Promise.resolve(Buffer.from(JSON.stringify(task))),
          getSignedDownloadUrl: () => Promise.resolve(source),
          uploadFile: async (path: string) => {
            await copyFile(path, output);
            return task.outputKey;
          },
          objectInfo: async (key: string) => ({
            size: (await stat(key === task.sourceKey ? source : output)).size,
          }),
          uploadBuffer: (body: Buffer, key: string) => {
            markers.push({
              key,
              value: JSON.parse(body.toString()) as unknown,
            });
            return Promise.resolve(key);
          },
        };
        await runRenderer(
          `${prefix}/task.json`,
          'fixture-job',
          new ConfigService({
            R2_BUCKET_NAME: outputBucket,
            R2_SOURCE_BUCKET_NAME: sourceBucket,
            R2_ENDPOINT: 'https://r2.invalid',
          }),
          r2 as never,
        );
        const { stdout } = await exec(process.env.EDIT_FFPROBE_PATH!, [
          '-v',
          'error',
          '-show_streams',
          '-show_format',
          '-of',
          'json',
          output,
        ]);
        const info = JSON.parse(stdout) as {
          streams: { codec_type: string; width?: number; height?: number }[];
          format: { duration: string };
        };
        expect(
          info.streams.find((s) => s.codec_type === 'video'),
        ).toMatchObject({ width: 1080, height: 1920 });
        expect(info.streams.some((s) => s.codec_type === 'audio')).toBe(true);
        expect(Math.abs(Number(info.format.duration) - 0.5)).toBeLessThan(0.15);
        expect(
          markers.find((m) => m.key.endsWith('/result.json'))?.value,
        ).toMatchObject({ jobId: 'fixture-job', outputKey: task.outputKey });
      },
      30000,
    );
  },
);
