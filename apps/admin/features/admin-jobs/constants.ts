import type { JobStatus } from "./types";
export const JOB_STATUS_VARIANTS: Record<
  JobStatus,
  "default" | "secondary" | "outline" | "destructive"
> = {
  completed: "default",
  transcribing: "secondary",
  detecting_highlights: "secondary",
  cutting_clips: "secondary",
  pending: "outline",
  failed: "destructive",
  cancelling: "secondary",
  cancelled: "outline",
};
export const JOB_STATUS_LABELS: Record<JobStatus, string> = {
  completed: "Completed",
  transcribing: "Transcribing",
  detecting_highlights: "AI Highlights",
  cutting_clips: "FFmpeg Render",
  pending: "Pending",
  failed: "Failed",
  cancelling: "Cancelling",
  cancelled: "Cancelled",
};
