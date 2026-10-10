import { Schema } from 'mongoose';
import type { EditPlan } from './edit-plan.contract';

export interface EditSource {
  jobId: string;
  clipId: string;
  storageKey: string;
  duration: number;
  etag?: string;
}
export interface StoredEditPlan {
  studioInitialization?: boolean;
  lastAppliedProposalId?: string;
  userId: string;
  sourceClipId: string;
  sourceMedia: EditSource;
  schemaVersion: number;
  revision: number;
  plan: EditPlan;
  outputDuration: number;
  status: string;
}
export interface EditVersion {
  userId: string;
  planId: string;
  revision: number;
  sourceClipId: string;
  sourceMedia: EditSource;
  plan: EditPlan;
  outputDuration: number;
  profile: 'preview';
  status: string;
  progress: number;
  outputKey?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  renderStats?: {
    duration: number;
    width: number;
    height: number;
    bytes: number;
    wallSeconds: number;
  };
  completedAt?: Date;
  executionToken?: string;
  executionExpiresAt?: Date;
  cleanupPending?: boolean;
  pendingOutputKeys?: string[];
  assetEtags?: Record<string, string>;
  generation?: number;
  manualRetries?: number;
}
const sourceSchema = new Schema<EditSource>(
  {
    jobId: { type: String, required: true },
    clipId: { type: String, required: true },
    storageKey: { type: String, required: true },
    duration: { type: Number, required: true, min: 0, max: 600 },
    etag: String,
  },
  { _id: false },
);
export const EditPlanSchema = new Schema<StoredEditPlan>(
  {
    studioInitialization: Boolean,
    lastAppliedProposalId: String,
    userId: { type: String, required: true },
    sourceClipId: { type: String, required: true },
    sourceMedia: { type: sourceSchema, required: true },
    schemaVersion: { type: Number, required: true, enum: [1] },
    revision: { type: Number, required: true },
    plan: { type: Schema.Types.Mixed, required: true },
    outputDuration: Number,
    status: {
      type: String,
      enum: [
        'draft',
        'queued',
        'processing',
        'completed',
        'failed',
        'cancelled',
      ],
      default: 'draft',
    },
  },
  { timestamps: true },
);
EditPlanSchema.index({ userId: 1, sourceClipId: 1, createdAt: -1 });
EditPlanSchema.index(
  { userId: 1, sourceClipId: 1, studioInitialization: 1 },
  {
    unique: true,
    partialFilterExpression: { studioInitialization: true },
  },
);
export const EditVersionSchema = new Schema<EditVersion>(
  {
    userId: { type: String, required: true },
    planId: { type: String, required: true },
    revision: { type: Number, required: true },
    sourceClipId: String,
    sourceMedia: { type: sourceSchema, required: true },
    plan: { type: Schema.Types.Mixed, required: true },
    outputDuration: Number,
    profile: { type: String, enum: ['preview'], default: 'preview' },
    status: {
      type: String,
      enum: ['queued', 'processing', 'completed', 'failed', 'cancelled'],
      default: 'queued',
    },
    progress: { type: Number, default: 0 },
    outputKey: String,
    error: String,
    errorCode: String,
    retryable: Boolean,
    renderStats: { type: Object },
    completedAt: Date,
    executionToken: String,
    executionExpiresAt: Date,
    cleanupPending: { type: Boolean, default: false },
    assetEtags: { type: Map, of: String },
    pendingOutputKeys: { type: [String], default: [] },
    generation: { type: Number, default: 0 },
    manualRetries: { type: Number, default: 0 },
  },
  { timestamps: true },
);
EditVersionSchema.index(
  { planId: 1, revision: 1, profile: 1 },
  { unique: true },
);
EditVersionSchema.index({ userId: 1, sourceClipId: 1, createdAt: -1 });
EditVersionSchema.index({ status: 1, executionExpiresAt: 1, createdAt: 1 });
export interface EditAdmission {
  _id: string;
  active: string[];
}
export const EditAdmissionSchema = new Schema<EditAdmission>(
  { _id: String, active: { type: [String], default: [] } },
  { timestamps: true },
);
