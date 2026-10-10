import { Schema } from 'mongoose';
import type { ModelInput, ProviderInput } from './registry.contract';
import type { SealedSecret } from './credential-vault.service';
export interface AIProvider extends ProviderInput {
  createdAt: Date;
  updatedAt: Date;
}
export interface AICredential extends SealedSecret {
  providerId: string;
  label: string;
  enabled: boolean;
  archived: boolean;
  revision: number;
  createdBy: string;
  lastValidatedAt?: Date;
  lastValidationStatus?: string;
}
export interface AIModel extends ModelInput {
  archived: boolean;
  lastTestedAt?: Date;
  lastTestStatus?: string;
  testedCredentialId?: string;
  testedCredentialRevision?: number;
}
export interface AIRouting {
  _id: string;
  modelId: string;
  revision: number;
}
export interface AIUsage {
  providerModelId?: string;
  executionId: string;
  call: number;
  userId: string;
  modelId: string;
  providerId: string;
  taskType: string;
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  estimatedCostUsd?: number;
  pricing?: ModelInput['pricing'];
  latencyMs: number;
  status: string;
  errorCode?: string;
}
export const ProviderSchema = new Schema<AIProvider>(
  {
    code: { type: String, required: true, unique: true },
    name: String,
    adapter: {
      type: String,
      enum: ['google', 'openai', 'anthropic'],
      required: true,
    },
    enabled: { type: Boolean, default: false },
    description: String,
    defaultCredentialId: String,
  },
  { timestamps: true, collection: 'ai_providers' },
);
export const CredentialSchema = new Schema<AICredential>(
  {
    providerId: { type: String, required: true, index: true },
    label: String,
    enabled: Boolean,
    archived: { type: Boolean, default: false },
    revision: { type: Number, default: 1 },
    createdBy: String,
    ciphertext: { type: String, select: false, required: true },
    iv: { type: String, select: false, required: true },
    tag: { type: String, select: false, required: true },
    keyVersion: { type: String, select: false, required: true },
    lastValidatedAt: Date,
    lastValidationStatus: String,
  },
  { timestamps: true, collection: 'ai_provider_credentials' },
);
CredentialSchema.index({ providerId: 1, label: 1 }, { unique: true });
const capabilities = new Schema(
  {
    text: Boolean,
    vision: Boolean,
    audioInput: Boolean,
    structuredOutput: Boolean,
    toolCalling: Boolean,
  },
  { _id: false },
);
const settings = new Schema(
  {
    temperature: Number,
    maxOutputTokens: Number,
    timeoutMs: Number,
    maxRetries: Number,
  },
  { _id: false },
);
const access = new Schema(
  { allowedPlans: [String], selectable: Boolean },
  { _id: false },
);
const pricing = new Schema(
  {
    inputCostPerMillionTokens: Number,
    outputCostPerMillionTokens: Number,
    currency: String,
  },
  { _id: false },
);
export const ModelSchema = new Schema<AIModel>(
  {
    providerId: { type: String, required: true },
    credentialId: String,
    modelId: { type: String, required: true },
    displayName: String,
    description: String,
    enabled: Boolean,
    capabilities,
    tasks: { type: [String], default: undefined },
    settings,
    access,
    pricing,
    priority: Number,
    archived: { type: Boolean, default: false },
    lastTestedAt: Date,
    lastTestStatus: String,
    testedCredentialId: String,
    testedCredentialRevision: Number,
  },
  { timestamps: true, collection: 'ai_models' },
);
ModelSchema.index({ providerId: 1, modelId: 1 }, { unique: true });
export const RoutingSchema = new Schema<AIRouting>(
  {
    _id: String,
    modelId: { type: String, required: true },
    revision: { type: Number, default: 1 },
  },
  { timestamps: true, collection: 'ai_model_policies' },
);
export const UsageSchema = new Schema<AIUsage>(
  {
    providerModelId: String,
    executionId: String,
    call: Number,
    userId: String,
    modelId: String,
    providerId: String,
    taskType: String,
    inputTokens: Number,
    outputTokens: Number,
    totalTokens: Number,
    estimatedCostUsd: Number,
    pricing,
    latencyMs: Number,
    status: String,
    errorCode: String,
  },
  { timestamps: true, collection: 'ai_model_usage' },
);
UsageSchema.index({ executionId: 1, call: 1 }, { unique: true });
UsageSchema.index({ modelId: 1, createdAt: -1 });
export const registryModels = [
  { name: 'AIProvider', schema: ProviderSchema },
  { name: 'AICredential', schema: CredentialSchema },
  { name: 'AIModel', schema: ModelSchema },
  { name: 'AIRouting', schema: RoutingSchema },
  { name: 'AIUsage', schema: UsageSchema },
];
