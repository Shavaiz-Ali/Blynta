import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';
import {
  SourcePlatform,
  TranscriptSegment,
  TranscriptSegmentSchema,
  Highlight,
  HighlightSchema,
} from './job.schema';

export type SourceVideoDocument = SourceVideo & Document;

/**
 * SourceVideo — the canonical, shared, R2-backed cache for a unique (platform, externalId) pair.
 *
 * Design intent:
 *   - One SourceVideo per unique YouTube video ID (for now — YouTube is the only cacheable platform).
 *   - Multiple Jobs across different users can point at the same SourceVideo via sourceVideoId.
 *   - Each Job still owns its own distinct cut/captioned clips (stored under clips/<jobId>/...).
 *   - Deleting a Job NEVER deletes its associated SourceVideo — SourceVideo entries are shared
 *     and must not be cascaded from per-job deletions. SourceVideo-level R2 cleanup (e.g. evicting
 *     entries with no recent references) is a separate future concern, not implemented here.
 */
@Schema({ timestamps: true })
export class SourceVideo {
  @Prop({ required: true, enum: SourcePlatform })
  platform: SourcePlatform;

  @Prop({ required: true })
  externalId: string; // YouTube video ID only, for now — e.g. "dQw4w9WgXcQ"

  @Prop({ required: true })
  sourceUrl: string; // canonical URL, for reference/debugging

  @Prop()
  videoTitle: string; // from yt-dlp, e.g. "How I Built a Startup in 30 Days"

  @Prop()
  videoUploader: string; // channel name, from yt-dlp — free metadata, worth capturing

  // R2 object keys, NOT local paths — local paths are the job-level working copy used during
  // active processing; these keys are the durable, shared, permanent storage in R2.
  @Prop()
  videoObjectKey: string; // e.g. "source-videos/dQw4w9WgXcQ/video.mp4"

  @Prop()
  audioObjectKey: string; // e.g. "source-videos/dQw4w9WgXcQ/audio.wav"

  @Prop({ type: [TranscriptSegmentSchema], default: [] })
  transcript: TranscriptSegment[];

  @Prop({ type: Map, of: [HighlightSchema], default: {} })
  defaultHighlightsByPreset: Map<string, Highlight[]>;

  @Prop({ default: 0 })
  referenceCount: number; // how many Jobs currently point at this — informational, useful for future cleanup decisions

  @Prop()
  lastReferencedAt: Date;
}

export const SourceVideoSchema = SchemaFactory.createForClass(SourceVideo);

// One SourceVideo per unique (platform, externalId) pair
SourceVideoSchema.index({ platform: 1, externalId: 1 }, { unique: true });
