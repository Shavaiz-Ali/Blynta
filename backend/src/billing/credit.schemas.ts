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
  executionToken?: string;
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
const integer = (nonnegative = true) => ({
  type: Number,
  required: true,
  validate: {
    validator: (n: number) =>
      Number.isSafeInteger(n) && (!nonnegative || n >= 0),
    message: 'Credit quantity must be a safe integer in its permitted range',
  },
});
const PricingSchema = new Schema<PricingSnapshot>(
  {
    version: { type: String, required: true, immutable: true, maxlength: 80 },
    sourceSeconds: {
      type: Number,
      required: true,
      immutable: true,
      validate: (n: number) => Number.isFinite(n) && n > 0,
    },
    outputSeconds: {
      type: Number,
      required: true,
      immutable: true,
      validate: (n: number) => Number.isFinite(n) && n > 0,
    },
    studioSeconds: {
      type: Number,
      required: true,
      immutable: true,
      validate: (n: number) => Number.isFinite(n) && n > 0,
    },
    studioModifier: {
      type: Number,
      required: true,
      immutable: true,
      validate: (n: number) => Number.isFinite(n) && n > 0,
    },
    aiCredits: { ...integer(), immutable: true, min: 1 },
  },
  { _id: false },
);
export const CreditEntrySchema = new Schema<CreditEntry>(
  {
    userId: { type: String, required: true, immutable: true },
    key: { type: String, required: true, immutable: true },
    operationId: { type: String, required: true, immutable: true },
    product: {
      type: String,
      required: true,
      immutable: true,
      enum: ['ai-clips', 'studio', 'account'],
    },
    type: {
      type: String,
      required: true,
      immutable: true,
      enum: [
        'opening',
        'grant',
        'reserve',
        'charge',
        'release',
        'refund',
        'adjustment',
      ],
    },
    amount: { ...integer(), immutable: true },
    availableDelta: { ...integer(false), immutable: true },
    reservedDelta: { ...integer(false), immutable: true },
    availableAfter: { ...integer(), immutable: true },
    reservedAfter: { ...integer(), immutable: true },
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
    kind: {
      type: String,
      enum: ['clips', 'studio-export', 'studio-ai', 'studio-transcription'],
    },
    result: Schema.Types.Mixed,
    executionStartedAt: Date,
    executionToken: String,
    userId: { type: String, required: true, immutable: true },
    operationId: { type: String, required: true, immutable: true },
    product: {
      type: String,
      required: true,
      immutable: true,
      enum: ['ai-clips', 'studio'],
    },
    relatedId: { type: String, required: true, immutable: true },
    status: {
      type: String,
      required: true,
      enum: ['reserved', 'settled'],
      default: 'reserved',
    },
    authorized: { ...integer(), immutable: true },
    held: integer(),
    charged: { ...integer(), default: 0 },
    pricing: { type: PricingSchema, required: true, immutable: true },
    sourceSeconds: {
      type: Number,
      required: true,
      immutable: true,
      validate: (n: number) => Number.isFinite(n) && n >= 0,
    },
    maxOutputSeconds: {
      type: Number,
      required: true,
      immutable: true,
      validate: (n: number) => Number.isFinite(n) && n >= 0,
    },
    fingerprint: { type: String, required: true, immutable: true },
    generation: { ...integer(), default: 0 },
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
  operationId: { type: String, required: true },
  attemptId: { type: String, required: true },
  stage: { type: String, required: true },
  recordedAt: { type: Date, default: Date.now },
  metrics: { type: Schema.Types.Mixed, required: true },
});
ProcessingUsageSchema.index(
  { operationId: 1, attemptId: 1, stage: 1 },
  { unique: true },
);

CreditEntrySchema.pre('save', function () {
  if (!this.isNew && this.isModified())
    throw new Error('Credit ledger is append-only');
});
CreditEntrySchema.pre(
  'deleteOne',
  { document: true, query: false },
  function () {
    throw new Error('Credit ledger is append-only');
  },
);
CreditEntrySchema.pre('bulkWrite', function (operations) {
  if (operations.some((operation) => !('insertOne' in operation)))
    throw new Error('Credit ledger is append-only');
});
for (const action of [
  'updateOne',
  'updateMany',
  'findOneAndUpdate',
  'replaceOne',
  'findOneAndReplace',
] as const) {
  CreditOperationSchema.pre(action, function () {
    this.setOptions({ runValidators: true });
  });
}

CreditOperationSchema.pre('validate', function () {
  if (
    this.charged > this.authorized ||
    this.held + this.charged > this.authorized
  )
    this.invalidate('held', 'Operation exceeds its authorization');
  if (this.status === 'settled' && this.held !== 0)
    this.invalidate('held', 'Settled operation cannot retain a hold');
});
