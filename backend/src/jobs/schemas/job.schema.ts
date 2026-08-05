import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type JobDocument = Job & Document;

export enum JobStatus {
  PENDING = 'pending',
  TRANSCRIBING = 'transcribing',
  DETECTING_HIGHLIGHTS = 'detecting_highlights',
  CUTTING_CLIPS = 'cutting_clips',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export enum SourcePlatform {
  YOUTUBE = 'youtube',
  TIKTOK = 'tiktok',
  INSTAGRAM = 'instagram',
  UPLOAD = 'upload',
}

// A transcript segment — one chunk of speech with timing, from Whisper
@Schema({ _id: false })
export class TranscriptSegment {
  @Prop({ required: true })
  startTime: number; // seconds

  @Prop({ required: true })
  endTime: number;

  @Prop({ required: true })
  text: string;
}
export const TranscriptSegmentSchema = SchemaFactory.createForClass(TranscriptSegment);

// A detected highlight moment, before it's been cut into a clip
@Schema({ _id: false })
export class Highlight {
  @Prop({ required: true })
  startTime: number;

  @Prop({ required: true })
  endTime: number;

  @Prop()
  reason: string; // why the LLM flagged this moment, useful for debugging/tuning prompts

  @Prop({ min: 0, max: 1 })
  score: number; // confidence/engagement score, useful for ranking multiple highlights
}
export const HighlightSchema = SchemaFactory.createForClass(Highlight);

// A finished, cut clip — the actual deliverable to the user
@Schema({ timestamps: true })
export class Clip {
  @Prop({ type: Types.ObjectId, auto: true })
  _id: Types.ObjectId;

  @Prop({ required: true })
  startTime: number;

  @Prop({ required: true })
  endTime: number;

  @Prop()
  outputUrl: string; // where the final clip file lives (e.g. S3/VPS storage path)

  @Prop({ default: false })
  hasCaptions: boolean;

  @Prop({ enum: JobStatus, default: JobStatus.PENDING })
  status: JobStatus; // a single clip can fail cutting even if others succeed
}
export const ClipSchema = SchemaFactory.createForClass(Clip);

@Schema({ timestamps: true })
export class Job {
  @Prop({ type: Types.ObjectId, required: true, index: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  sourceUrl: string;

  @Prop({ enum: SourcePlatform, required: true })
  sourcePlatform: SourcePlatform;

  @Prop({ enum: JobStatus, default: JobStatus.PENDING, index: true })
  status: JobStatus;

  @Prop({ type: [TranscriptSegmentSchema], default: [] })
  transcript: TranscriptSegment[];

  @Prop({ type: [HighlightSchema], default: [] })
  highlights: Highlight[];

  @Prop({ type: [ClipSchema], default: [] })
  clips: Clip[];

  @Prop()
  errorMessage: string; // populated only if status = FAILED, for debugging/user display

  @Prop()
  errorStage: string; // which pipeline stage failed — transcription, highlight detection, or cutting
}

export const JobSchema = SchemaFactory.createForClass(Job);