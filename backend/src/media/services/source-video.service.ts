import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SourceVideo,
  SourceVideoDocument,
} from '../../jobs/schemas/source-video.schema';
import { SourcePlatform } from '../../jobs/schemas/job.schema';
import { extractYouTubeId } from '../utils/extract-youtube-id';

@Injectable()
export class SourceVideoService {
  private readonly logger = new Logger(SourceVideoService.name);

  constructor(
    @InjectModel(SourceVideo.name)
    private sourceVideoModel: Model<SourceVideoDocument>,
  ) {}

  /**
   * Extracts a platform-specific external ID from the source URL.
   *
   * Returns null if this platform doesn't support caching (anything but YouTube right now).
   * Callers MUST treat null as "always process fresh, no cache" — not an error.
   *
   * Non-YouTube platforms (TikTok, Instagram, Upload, etc.) intentionally return null here.
   * Do NOT fill these in as part of this task.
   */
  extractExternalId(platform: SourcePlatform, url: string): string | null {
    if (platform === SourcePlatform.YOUTUBE) {
      return extractYouTubeId(url);
    }
    // Reddit, Rumble, TikTok, Instagram, Upload, X/Twitter — caching not implemented.
    // Return null so the processor always treats these as cache misses (fresh processing).
    return null;
  }

  async findCached(
    platform: SourcePlatform,
    externalId: string,
  ): Promise<SourceVideoDocument | null> {
    return this.sourceVideoModel.findOne({ platform, externalId }).exec();
  }

  async createFromProcessing(params: {
    platform: SourcePlatform;
    externalId: string;
    sourceUrl: string;
    videoObjectKey: string;
    audioObjectKey: string;
    transcript: any[];
    videoTitle?: string;
    videoUploader?: string;
  }): Promise<SourceVideoDocument> {
    return this.sourceVideoModel
      .findOneAndUpdate(
        { platform: params.platform, externalId: params.externalId },
        {
          $set: {
            ...params,
            lastReferencedAt: new Date(),
          },
          $setOnInsert: {
            referenceCount: 1,
            defaultHighlightsByPreset: {},
          },
        },
        { upsert: true, returnDocument: 'after' },
      )
      .exec() as Promise<SourceVideoDocument>;
  }

  async recordReuse(sourceVideoId: string): Promise<void> {
    await this.sourceVideoModel
      .updateOne(
        { _id: sourceVideoId },
        {
          $inc: { referenceCount: 1 },
          $set: { lastReferencedAt: new Date() },
        },
      )
      .exec();
  }

  async saveDefaultHighlights(
    sourceVideoId: string,
    presetKey: string,
    highlights: any[],
  ): Promise<void> {
    await this.sourceVideoModel
      .updateOne(
        { _id: sourceVideoId },
        { $set: { [`defaultHighlightsByPreset.${presetKey}`]: highlights } },
      )
      .exec();
  }
}
