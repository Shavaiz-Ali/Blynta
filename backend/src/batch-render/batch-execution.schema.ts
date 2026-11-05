import { Schema } from 'mongoose';

export interface BatchExecution {
  _id: string;
  prefix: string;
  state: string;
  jobId?: string;
  deadline: Date;
  error?: string;
  retryable?: boolean;
  failureCode?: string;
  failureStage?: string;
  lastBatchStatus?: string;
  outputKey?: string;
  durationSeconds?: number;
  diagnostics?: {
    statusReason?: string;
    containerReason?: string;
    exitCode?: number;
    logStreamName?: string;
    jobDefinition?: string;
    image?: string;
    attempts?: number;
  };
  owner?: {
    jobId?: string;
    clipId?: string;
    planId?: string;
    revision?: number;
    generation?: number;
  };
}

// _id is the unique durable submission claim. Do not TTL active executions.
export const BatchExecutionSchema = new Schema<BatchExecution>(
  {
    _id: { type: String, required: true },
    prefix: { type: String, required: true },
    state: { type: String, required: true, index: true },
    jobId: String,
    deadline: { type: Date, required: true, index: true },
    error: String,
    retryable: Boolean,
    failureCode: String,
    failureStage: String,
    lastBatchStatus: String,
    outputKey: String,
    durationSeconds: Number,
    diagnostics: { type: Schema.Types.Mixed },
    owner: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
