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
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  customPrompt?: string;
  aiModel?: string;
  stylePreset?: string;
}

export interface Job {
  id: string;
  _id: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  videoTitle?: string;
  videoDescription?: string;
  keywords?: string;
  hashtags?: string[];
  videoUploader?: string;
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
