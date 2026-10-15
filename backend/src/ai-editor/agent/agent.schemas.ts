import { Schema } from 'mongoose';
import type { EditPatch } from './edit-patch';
import type { EditPlan } from '../edit-plan.contract';
export interface AgentSession {
  title?: string;
  requestId?: string;
  userId: string;
  clipId: string;
  planId: string;
  selectedModelId?: string;
  status: string;
}
export interface AgentMessage {
  userId: string;
  sessionId: string;
  role: string;
  content: string;
  proposalId?: string;
  modelId?: string;
  executionId: string;
}
export interface EditProposal {
  noChanges?: boolean;
  diagnostics?: import('./agent-diagnostics').AgentDiagnostic[];
  executionBuild?: object;
  failedStage?: string;
  retryable?: boolean;
  beforePlan?: EditPlan;
  createdAt?: Date;
  userId: string;
  clipId: string;
  planId: string;
  sessionId: string;
  requestId: string;
  fingerprint: string;
  executionId: string;
  baseRevision: number;
  patch?: EditPatch;
  summary: string;
  status: string;
  modelId: string;
  appliedRevision?: number;
  errorCode?: string;
}
export const SessionSchema = new Schema<AgentSession>(
  {
    title: { type: String, maxlength: 100 },
    requestId: String,
    userId: { type: String, required: true },
    clipId: String,
    planId: String,
    selectedModelId: String,
    status: { type: String, enum: ['active', 'archived'], default: 'active' },
  },
  { timestamps: true, collection: 'ai_agent_sessions' },
);
SessionSchema.index({ userId: 1, clipId: 1, createdAt: -1 });
SessionSchema.index(
  { userId: 1, requestId: 1 },
  { unique: true, partialFilterExpression: { requestId: { $type: 'string' } } },
);
export const MessageSchema = new Schema<AgentMessage>(
  {
    userId: String,
    sessionId: String,
    role: { type: String, enum: ['user', 'assistant', 'tool'] },
    content: { type: String, maxlength: 12000 },
    proposalId: String,
    modelId: String,
    executionId: String,
  },
  { timestamps: true, collection: 'ai_agent_messages' },
);
MessageSchema.index({ userId: 1, sessionId: 1, createdAt: -1 });
export const ProposalSchema = new Schema<EditProposal>(
  {
    noChanges: Boolean,
    diagnostics: { type: [Schema.Types.Mixed], default: [] },
    executionBuild: Schema.Types.Mixed,
    failedStage: String,
    retryable: Boolean,
    userId: { type: String, required: true },
    clipId: String,
    planId: String,
    sessionId: String,
    requestId: String,
    fingerprint: String,
    executionId: String,
    baseRevision: Number,
    beforePlan: Schema.Types.Mixed,
    patch: Schema.Types.Mixed,
    summary: String,
    status: {
      type: String,
      enum: [
        'generating',
        'pending',
        'applying',
        'clarification',
        'unsupported',
        'applied',
        'rejected',
        'failed',
        'cancelled',
      ],
      default: 'generating',
    },
    modelId: String,
    appliedRevision: Number,
    errorCode: String,
  },
  { timestamps: true, collection: 'ai_edit_proposals' },
);
ProposalSchema.index({ userId: 1, requestId: 1 }, { unique: true });
ProposalSchema.index({ userId: 1, clipId: 1, createdAt: -1 });
export const agentModels = [
  { name: 'AIAgentSession', schema: SessionSchema },
  { name: 'AIAgentMessage', schema: MessageSchema },
  { name: 'AIEditProposal', schema: ProposalSchema },
];
