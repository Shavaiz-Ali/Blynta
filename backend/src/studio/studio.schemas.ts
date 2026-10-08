import { Schema } from 'mongoose';
import type { StudioDocument } from './studio.contract';
export interface StudioProject {
  userId: string;
  name: string;
  version: number;
  revision: number;
  document: StudioDocument;
  source: string;
  importKey?: string;
  sourceJobId?: string;
  updatedAt: Date;
}
export interface StudioAsset {
  transcriptionCreditOperationId?: string;
  userId: string;
  projectId: string;
  assetId: string;
  storageKey: string;
  name: string;
  kind: 'video' | 'audio' | 'image';
  mimeType: string;
  size: number;
  status: string;
  duration: number;
  width?: number;
  height?: number;
  hasAudio?: boolean;
  thumbnailKey?: string;
  transcriptStatus?: string;
  transcript?: { startTime: number; endTime: number; text: string }[];
  sourceGroup?: string;
  error?: string;
}
export interface StudioRender {
  creditOperationId?: string;
  userId: string;
  projectId: string;
  status: string;
  progress: number;
  document: StudioDocument;
  settings: { resolution: '720p' | '1080p'; fps: number; format: 'mp4' };
  outputKey?: string;
  error?: string;
  completedAt?: Date;
}
export const StudioProjectSchema = new Schema<StudioProject>(
  {
    userId: { type: String, required: true },
    name: String,
    version: { type: Number, default: 1 },
    revision: { type: Number, default: 0 },
    document: { type: Schema.Types.Mixed, required: true },
    source: { type: String, default: 'Studio' },
    importKey: String,
    sourceJobId: String,
  },
  { timestamps: true },
);
StudioProjectSchema.index({ userId: 1, updatedAt: -1 });
StudioProjectSchema.index(
  { userId: 1, importKey: 1 },
  { unique: true, partialFilterExpression: { importKey: { $type: 'string' } } },
);
export const StudioAssetSchema = new Schema<StudioAsset>(
  {
    transcriptionCreditOperationId: String,
    userId: String,
    projectId: String,
    assetId: String,
    storageKey: String,
    name: String,
    kind: String,
    mimeType: String,
    size: Number,
    status: { type: String, default: 'pending' },
    duration: Number,
    width: Number,
    height: Number,
    hasAudio: Boolean,
    thumbnailKey: String,
    transcriptStatus: String,
    transcript: { type: Schema.Types.Mixed },
    sourceGroup: String,
    error: String,
  },
  { timestamps: true },
);
StudioAssetSchema.index(
  { userId: 1, projectId: 1, assetId: 1 },
  { unique: true },
);
export const StudioRenderSchema = new Schema<StudioRender>(
  {
    creditOperationId: String,
    userId: String,
    projectId: String,
    status: { type: String, default: 'queued' },
    progress: { type: Number, default: 0 },
    document: { type: Schema.Types.Mixed, required: true },
    settings: { type: Schema.Types.Mixed, required: true },
    outputKey: String,
    error: String,
    completedAt: Date,
  },
  { timestamps: true },
);
StudioRenderSchema.index({ userId: 1, projectId: 1, createdAt: -1 });
