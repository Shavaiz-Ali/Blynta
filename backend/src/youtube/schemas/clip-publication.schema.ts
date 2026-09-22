import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type ClipPublicationDocument = ClipPublication & Document;

/**
 * Extensible platform enum.
 * Only YOUTUBE is implemented now — adding INSTAGRAM/TIKTOK/etc. later
 * requires no change to the Clip or Job schemas.
 */
export enum PublicationPlatform {
  YOUTUBE = 'youtube',
}

export enum PublicationStatus {
  QUEUED = 'queued',
  UPLOADING = 'uploading',
  PROCESSING = 'processing',
  PUBLISHED = 'published',
  FAILED = 'failed',
}

/**
 * Records a single clip-to-platform publication attempt.
 *
 * Intentionally separate from the Job/Clip schema so that:
 *   1. The clip schema is not polluted with platform-specific fields.
 *   2. Multiple platforms can be supported without schema migrations.
 *   3. Each attempt (including retries) is independently traceable.
 */
@Schema({ timestamps: true })
export class ClipPublication {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  /** The Job document that owns the clip. */
  @Prop({ type: Types.ObjectId, required: true, index: true })
  jobId: Types.ObjectId;

  /** The clip's sub-document _id (stored as string for simplicity). */
  @Prop({ required: true })
  clipId: string;

  @Prop({
    enum: PublicationPlatform,
    required: true,
    default: PublicationPlatform.YOUTUBE,
  })
  platform: PublicationPlatform;

  @Prop({
    enum: PublicationStatus,
    required: true,
    default: PublicationStatus.QUEUED,
    index: true,
  })
  status: PublicationStatus;

  /** Title submitted by the user. */
  @Prop({ required: true })
  title: string;

  /** Description submitted by the user (optional). */
  @Prop()
  description: string;

  /** YouTube privacy setting: private | unlisted | public. */
  @Prop({ required: true, default: 'private' })
  privacyStatus: string;

  /**
   * YouTube video tags submitted by the user.
   * Passed to snippet.tags in videos.insert.
   */
  @Prop({ type: [String] })
  tags: string[];

  /**
   * YouTube video category ID (from videoCategories.list).
   * Passed to snippet.categoryId in videos.insert.
   */
  @Prop()
  categoryId: string;

  /**
   * R2 object key for a custom thumbnail image.
   * If present, the worker calls thumbnails.set after a successful video upload.
   * A failed thumbnails.set does NOT fail the publication.
   */
  @Prop()
  thumbnailKey: string;

  /** YouTube video ID after successful upload (e.g. "dQw4w9WgXcQ"). */
  @Prop()
  externalId: string;

  /** Full YouTube watch URL after successful upload. */
  @Prop()
  externalUrl: string;

  /** Human-readable error message saved on failure. NOT raw API errors. */
  @Prop()
  error: string;

  /** When the clip was successfully published. */
  @Prop()
  publishedAt: Date;

  /** Optional platform-specific metadata for debugging / future use. */
  @Prop({ type: Object })
  metadata: Record<string, unknown>;
}

export const ClipPublicationSchema =
  SchemaFactory.createForClass(ClipPublication);

// Prevent two active uploads of the same clip to the same platform simultaneously.
// Note: we allow multiple publications per clip (for retries), hence no global unique.
ClipPublicationSchema.index({ jobId: 1, clipId: 1, platform: 1, status: 1 });
