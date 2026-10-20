import { Schema } from 'mongoose';

export interface BatchExecution {
  _id: string;
  prefix: string;
  state: string;
  jobId?: string;
  deadline: Date;
  error?: string;
  retryable?: boolean;
  owner?: {
    jobId?: string;
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
    owner: { type: Schema.Types.Mixed },
  },
  { timestamps: true },
);
