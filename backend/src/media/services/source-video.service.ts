import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  SourceVideo,
  SourceVideoDocument,
} from '../../jobs/schemas/source-video.schema';
import { SourcePlatform } from '../../jobs/schemas/job.schema';
import { extractYouTubeId } from '../utils/extract-youtube-id';
import { MediaMetadata } from './media-inspection.service';

@Injectable()
export class SourceVideoService {
  private readonly logger = new Logger(SourceVideoService.name);

  constructor(
    @InjectModel(SourceVideo.name)
    private sourceVideoModel: Model<SourceVideoDocument>,
    @Optional() private readonly config?: ConfigService,
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
    const since = new Date(
      Date.now() -
        Math.max(
          1,
          this.config?.get<number>('PIPELINE_CACHE_TTL_DAYS', 30) ?? 30,
        ) *
          86400000,
    );
    return this.sourceVideoModel
      .findOne({
        platform,
        externalId,
        $or: [
          { mediaPreparedAt: { $gt: since } },
          { mediaPreparedAt: { $exists: false }, createdAt: { $gt: since } },
        ],
      })
      .exec();
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
    thumbnailUrl?: string;
    videoDuration?: number;
    contentHash?: string;
    audioContentHash?: string;
    transcriptSignature?: string;
  }): Promise<SourceVideoDocument> {
    return this.sourceVideoModel
      .findOneAndUpdate(
        { platform: params.platform, externalId: params.externalId },
        {
          $set: {
            ...params,
            mediaPreparedAt: new Date(),
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

  async saveMediaMetadata(sourceVideoId: string, mediaMetadata: MediaMetadata) {
    await this.sourceVideoModel
      .updateOne({ _id: sourceVideoId }, { $set: { mediaMetadata } })
      .exec();
  }

  async saveAudio(
    sourceVideoId: string,
    audioObjectKey: string,
    audioContentHash: string,
    sourceVersion: string,
  ) {
    await this.sourceVideoModel
      .updateOne(
        {
          _id: sourceVideoId,
          $or: [
            { contentHash: sourceVersion },
            { contentHash: { $exists: false } },
          ],
        },
        {
          $set: {
            audioObjectKey,
            audioContentHash,
            contentHash: sourceVersion,
          },
        },
      )
      .exec();
  }

  async saveTranscript(
    sourceVideoId: string,
    transcript: unknown[],
    transcriptSignature: string,
    sourceVersion: string,
  ) {
    await this.sourceVideoModel
      .updateOne(
        {
          _id: sourceVideoId,
          $or: [
            { contentHash: sourceVersion },
            { contentHash: { $exists: false } },
          ],
        },
        {
          $set: { transcript, transcriptSignature, contentHash: sourceVersion },
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
