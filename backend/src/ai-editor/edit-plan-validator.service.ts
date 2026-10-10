import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import type { StudioAsset } from '../studio/studio.schemas';
import { R2Service } from '../storage/r2.service';
import { EditPlan, parseEdit, planSchema } from './edit-plan.contract';
import { compileTimeline } from './timeline';
const assetError = (assetId: string, message: string) =>
  new BadRequestException({
    message,
    code: 'INVALID_EDIT_ASSET',
    issues: [{ path: `assets.${assetId}`, message }],
  });

export function assetReferences(plan: EditPlan) {
  return [
    ...new Set([
      ...plan.audio.tracks.filter((t) => t.enabled).map((t) => t.assetId),
      ...plan.operations.flatMap((o) =>
        o.enabled && (o.type === 'image_overlay' || o.type === 'emoji_overlay')
          ? [o.params.assetId]
          : [],
      ),
    ]),
  ];
}
@Injectable()
export class EditPlanValidatorService {
  constructor(
    @InjectModel('StudioAsset') private assets: Model<StudioAsset>,
    private r2: R2Service,
  ) {}
  async validate(userId: string, value: unknown, sourceDuration: number) {
    const plan = parseEdit(planSchema, value);
    const timeline = compileTimeline(plan, sourceDuration);
    const media = new Map<string, StudioAsset & { etag?: string }>();
    let totalBytes = 0;
    for (const assetId of assetReferences(plan)) {
      const records = await this.assets
        .find({ userId, assetId, status: 'ready' })
        .limit(2)
        .lean();
      if (records.length !== 1)
        throw new NotFoundException({
          message: 'Editing asset is unavailable',
          code: 'EDIT_ASSET_UNAVAILABLE',
          issues: [
            {
              path: `assets.${assetId}`,
              message:
                'Asset is missing, ambiguous, unprocessed, or unauthorized',
            },
          ],
        });
      const a = records[0];
      const info = await this.r2
        .objectInfo(a.storageKey)
        .catch((error: unknown) => {
          const missing = error as {
            name?: string;
            $metadata?: { httpStatusCode?: number };
          };
          if (
            missing.$metadata?.httpStatusCode === 404 ||
            missing.name === 'NotFound' ||
            missing.name === 'NoSuchKey'
          )
            throw assetError(assetId, 'Media object is no longer available');
          throw error;
        });
      if (!info.size || info.size > 100 * 1024 * 1024)
        throw assetError(
          assetId,
          'Editing assets must be nonempty and at most 100 MiB',
        );
      totalBytes += info.size;
      if (totalBytes > 300 * 1024 * 1024)
        throw assetError(
          assetId,
          'Editing assets exceed the 300 MiB aggregate budget',
        );
      const audio = plan.audio.tracks.filter(
        (t) => t.enabled && t.assetId === assetId,
      );
      if (
        audio.length &&
        (a.kind !== 'audio' ||
          ![
            'audio/mpeg',
            'audio/wav',
            'audio/x-wav',
            'audio/mp4',
            'audio/ogg',
          ].includes(a.mimeType) ||
          info.contentType !== a.mimeType ||
          !a.hasAudio)
      )
        throw assetError(assetId, `Asset ${assetId} must be validated audio`);
      if (audio.some((t) => t.sourceEnd > a.duration))
        throw assetError(
          assetId,
          `Audio trim exceeds asset ${assetId} duration`,
        );
      if (
        plan.operations.some(
          (o) =>
            o.enabled &&
            (o.type === 'image_overlay' || o.type === 'emoji_overlay') &&
            o.params.assetId === assetId,
        ) &&
        (a.kind !== 'image' ||
          a.mimeType !== 'image/png' ||
          info.contentType !== 'image/png' ||
          !a.width ||
          !a.height ||
          a.width * a.height > 4_000_000)
      )
        throw assetError(
          assetId,
          `Overlay ${assetId} must be a validated static PNG within 4 megapixels`,
        );
      media.set(assetId, { ...a, etag: info.etag });
    }
    return { plan, timeline, media };
  }
}
