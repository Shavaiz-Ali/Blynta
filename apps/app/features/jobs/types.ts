/* -------------------------------------------------------------------------- */
/*                                Enums                                       */
/* -------------------------------------------------------------------------- */

export enum SourcePlatform {
  YOUTUBE = "youtube",
  TIKTOK = "tiktok",
  INSTAGRAM = "instagram",
  UPLOAD = "upload",
}

export enum JobStatus {
  PENDING = "pending",
  TRANSCRIBING = "transcribing",
  DETECTING_HIGHLIGHTS = "detecting_highlights",
  CUTTING_CLIPS = "cutting_clips",
  COMPLETED = "completed",
  FAILED = "failed",
  CANCELLING = "cancelling",
  CANCELLED = "cancelled",
}

/* -------------------------------------------------------------------------- */
/*                                Interfaces                                  */
/* -------------------------------------------------------------------------- */

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface Highlight {
  startTime: number;
  endTime: number;
  reason?: string;
  score?: number;
  clipTitle?: string;
  clipDescription?: string;
  tags?: string[];
  style?: string;
  hookText?: string;
  emojis?: string[];
}

export interface Clip {
  failure?: {
    message: string;
    reason?: string;
    stage?: string;
    failedAt?: string;
    attempt?: number;
    retryAvailable?: boolean;
  };
  processingState?:
    | "queued"
    | "cutting"
    | "captioning"
    | "uploading"
    | "ready"
    | "failed"
    | "cancelled";
  errorMessage?: string;
  errorStage?: string;
  id: string;
  _id: string;
  startTime: number;
  endTime: number;
  outputUrl?: string;
  localFilePath?: string;
  captionedFilePath?: string;
  downloadUrl: string;
  hasCaptions: boolean;
  status: JobStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface StylePresetInfo {
  key: string;
  label: string;
  isPro: boolean;
}

export interface CreateJobInput {
  operationId?: string;
  sourceSeconds?: number;
  maxOutputSeconds?: number;
  authorizedCredits?: number;
  pricingVersion?: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  customPrompt?: string;
  aiModel?: string;
  stylePreset?: string;
}

export interface Job {
  generationSummary?: {
    targetMin: number;
    targetMax: number;
    accepted: number;
    shortfall: number;
    reason: string;
  };
  billing?: {
    authorized: number;
    held: number;
    charged: number;
    status: "reserved" | "settled";
    pricingVersion: string;
  };
  processingFailure?: { code: string; message: string };
  cancellationRequestedAt?: string;
  cancelledAt?: string;
  cancellationPendingReason?: "worker_confirmation_required";
  deletionRequested?: boolean;
  deletionAvailable?: boolean;
  /** Optional authoritative full-job estimate. Absent from the current API. */
  estimatedRemainingSeconds?: number | null;
  mediaMetadata?: {
    durationSeconds: number;
    width?: number;
    height?: number;
    fps?: number;
    codec?: string;
    bitrate?: number;
    fileSizeBytes?: number;
    audioCodec?: string;
    sampleRate?: number;
    hasAudio: boolean;
    hasVideo: boolean;
  };
  workload?: { score: number; classification: "small" | "medium" | "large" };
  render?: {
    ready: number;
    failed: number;
    total: number;
    progressPercent: number;
    clips: {
      clipId: string;
      status: NonNullable<Clip["processingState"]>;
      progress: number;
      stageProgress?: number;
      etaScope?: "stage";
      renderProgress: number;
      processedSeconds?: number;
      durationSeconds: number;
      speed?: number;
      etaSeconds?: number;
      frame?: number;
      fps?: number;
      updatedAt?: number;
    }[];
  };
  id: string;
  _id: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  videoTitle?: string;
  videoDescription?: string;
  keywords?: string;
  hashtags?: string[];
  videoUploader?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  status: JobStatus;
  errorMessage?: string | null;
  errorStage?: string | null;
  progressPercent?: number;
  resolutionUsed?: string;
  localVideoPath?: string;
  localAudioPath?: string;
  customPrompt?: string;
  aiModel?: string;
  stylePreset?: string;
  transcript: TranscriptSegment[];
  highlights: Highlight[];
  clips: Clip[];
  createdAt: string;
  updatedAt: string;
}

export interface JobsListParams {
  status?: JobStatus;
  page?: number;
  limit?: number;
}

export interface JobsListResult {
  jobs: Job[];
  total: number;
  page: number;
  totalPages: number;
}
