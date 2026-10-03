export type JobStatus =
  | "pending"
  | "transcribing"
  | "detecting_highlights"
  | "cutting_clips"
  | "completed"
  | "failed";

export type SourcePlatform = "youtube" | "tiktok" | "instagram" | "upload";

export interface ClipHighlight {
  startTime: number;
  endTime: number;
  reason?: string;
  score?: number;
  clipTitle?: string;
  clipDescription?: string;
  tags?: string[];
  hookText?: string;
  emojis?: string[];
}

export interface JobClip {
  _id: string;
  startTime: number;
  endTime: number;
  outputUrl?: string;
  downloadUrl?: string;
  r2ObjectKey?: string;
  hasCaptions?: boolean;
  status?: JobStatus;
  createdAt?: string;
}

export interface TranscriptSegment {
  startTime: number;
  endTime: number;
  text: string;
}

export interface JobUser {
  _id: string;
  email: string;
  name?: string;
  plan?: string;
  role?: string;
  creditsBalance?: number;
}

export interface AdminJobItem {
  _id: string;
  userId: string | JobUser;
  userEmail?: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  status: JobStatus;
  videoTitle?: string;
  videoUploader?: string;
  thumbnailUrl?: string;
  videoDuration?: number;
  progressPercent: number;
  clipsCount?: number;
  clips?: JobClip[];
  highlights?: ClipHighlight[];
  transcript?: TranscriptSegment[];
  errorMessage?: string;
  errorStage?: string;
  stylePreset?: string;
  aiModel?: string;
  resolutionUsed?: string;
  customPrompt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface ListJobsParams {
  page?: number;
  limit?: number;
  search?: string;
  status?: JobStatus;
  userId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface PaginatedJobsResponse {
  data: AdminJobItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface QueueStatusItem {
  name: string;
  label: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
  paused: boolean;
  isHealthy: boolean;
}

export interface JobStatsResponse {
  totalJobs: number;
  last24Hours: { total: number; byStatus: Record<string, number> };
  last7Days: { total: number; byStatus: Record<string, number> };
  allTimeByStatus: Record<string, number>;
}
