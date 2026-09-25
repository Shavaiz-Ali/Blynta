export type JobStatus =
  | "pending"
  | "transcribing"
  | "detecting_highlights"
  | "cutting_clips"
  | "completed"
  | "failed";

export type SourcePlatform = "youtube" | "tiktok" | "instagram" | "upload";

export interface AdminJobItem {
  _id: string;
  userId: string;
  userEmail?: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  status: JobStatus;
  videoTitle?: string;
  videoUploader?: string;
  videoDuration?: number;
  progressPercent: number;
  clipsCount: number;
  errorMessage?: string;
  errorStage?: string;
  stylePreset?: string;
  aiModel?: string;
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
