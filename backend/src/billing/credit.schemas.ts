import { Schema } from 'mongoose';
import type { PricingSnapshot } from './credit-pricing';

export type CreditProduct = 'ai-clips' | 'studio' | 'account';
export type CreditType =
  | 'opening'
  | 'grant'
  | 'reserve'
  | 'charge'
  | 'release'
  | 'refund'
  | 'adjustment';
export interface CreditEntry {
  userId: string;
  key: string;
  operationId: string;
  product: CreditProduct;
  type: CreditType;
  amount: number;
  availableDelta: number;
  reservedDelta: number;
  availableAfter: number;
  reservedAfter: number;
  pricingVersion?: string;
  relatedId?: string;
  description: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}
export interface CreditOperation {
  deliveredOutputs?: { id: string; seconds: number }[];
  kind?: 'clips' | 'studio-export' | 'studio-ai' | 'studio-transcription';
  result?: unknown;
  executionStartedAt?: Date;
  userId: string;
  operationId: string;
  product: CreditProduct;
  relatedId: string;
  status: 'reserved' | 'settled';
  authorized: number;
  held: number;
  charged: number;
  pricing: PricingSnapshot;
  sourceSeconds: number;
  maxOutputSeconds: number;
  fingerprint: string;
  generation: number;
  createdAt: Date;
  updatedAt: Date;
}
export const CreditEntrySchema = new Schema<CreditEntry>(
  {
    userId: { type: String, required: true, immutable: true },
    key: { type: String, required: true, immutable: true },
    operationId: { type: String, required: true, immutable: true },
    product: { type: String, required: true, immutable: true },
    type: { type: String, required: true, immutable: true },
    amount: { type: Number, required: true, immutable: true },
    availableDelta: { type: Number, required: true, immutable: true },
    reservedDelta: { type: Number, required: true, immutable: true },
    availableAfter: { type: Number, required: true, immutable: true },
    reservedAfter: { type: Number, required: true, immutable: true },
    pricingVersion: { type: String, immutable: true },
    relatedId: { type: String, immutable: true },
    description: { type: String, immutable: true },
    metadata: { type: Schema.Types.Mixed, immutable: true },
    createdAt: { type: Date, default: Date.now, immutable: true },
  },
  { versionKey: false },
);
CreditEntrySchema.index({ key: 1 }, { unique: true });
CreditEntrySchema.index({ userId: 1, createdAt: -1, _id: -1 });
CreditEntrySchema.index({ userId: 1, product: 1, createdAt: -1 });
CreditEntrySchema.index({ userId: 1, type: 1, createdAt: -1 });
for (const action of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'deleteOne',
  'deleteMany',
  'findOneAndDelete',
  'replaceOne',
  'findOneAndReplace',
] as const) {
  CreditEntrySchema.pre(action, function () {
    throw new Error('Credit ledger is append-only. Use a compensating entry.');
  });
}
export const CreditOperationSchema = new Schema<CreditOperation>(
  {
    deliveredOutputs: { type: [{ id: String, seconds: Number }], default: [] },
    kind: String,
    result: Schema.Types.Mixed,
    executionStartedAt: Date,
    userId: { type: String, required: true, immutable: true },
    operationId: { type: String, required: true, immutable: true },
    product: { type: String, immutable: true },
    relatedId: { type: String, immutable: true },
    status: { type: String, default: 'reserved' },
    authorized: { type: Number, immutable: true },
    held: Number,
    charged: { type: Number, default: 0 },
    pricing: { type: Schema.Types.Mixed, required: true, immutable: true },
    sourceSeconds: { type: Number, immutable: true },
    maxOutputSeconds: { type: Number, immutable: true },
    fingerprint: { type: String, immutable: true },
    generation: { type: Number, default: 0 },
  },
  { timestamps: true },
);
CreditOperationSchema.index({ operationId: 1 }, { unique: true });
CreditOperationSchema.index({ status: 1, updatedAt: 1 });

export interface ProcessingUsage {
  operationId: string;
  attemptId: string;
  stage: string;
  recordedAt: Date;
  metrics: Record<string, unknown>;
}
export const ProcessingUsageSchema = new Schema<ProcessingUsage>({
  operationId: String,
  attemptId: String,
  stage: String,
  recordedAt: { type: Date, default: Date.now },
  metrics: Schema.Types.Mixed,
});
ProcessingUsageSchema.index(
  { operationId: 1, attemptId: 1, stage: 1 },
  { unique: true },
);
