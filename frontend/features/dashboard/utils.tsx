import * as React from "react";
import { Job, JobStatus, SourcePlatform } from "@/features/jobs";
import { cn } from "@/lib/utils";
import {
  YoutubeIcon,
  TiktokIcon,
  InstagramIcon,
  UploadIcon,
} from "./icons";

export function getFirstName(fullName: string): string {
  if (!fullName) return "";
  const parts = fullName.trim().split(/\s+/);
  return parts[0] || fullName;
}

export function truncateUrl(url: string, max = 55): string {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    const clean = parsed.host.replace(/^www\./, "") + parsed.pathname;
    return clean.length > max ? clean.slice(0, max - 1) + "…" : clean;
  } catch {
    return url.length > max ? url.slice(0, max - 1) + "…" : url;
  }
}

/**
 * Returns the best human-readable title for a job.
 * Prefers videoTitle when it's a real title (not the fallback "Untitled video" string),
 * falls back to the truncated source URL.
 */
export function getJobDisplayTitle(job: Pick<Job, "videoTitle" | "sourceUrl">, maxUrlLen = 55): string {
  if (job.videoTitle && job.videoTitle.trim() && job.videoTitle !== "Untitled video") {
    return job.videoTitle;
  }
  return truncateUrl(job.sourceUrl, maxUrlLen);
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function countCompletedClips(jobs: Job[]): number {
  let count = 0;
  for (const j of jobs) {
    if (j.status === JobStatus.COMPLETED) {
      count += 1;
    }
  }
  return count;
}

export function getActiveJobs(jobs: Job[]): Job[] {
  const active: JobStatus[] = [
    JobStatus.PENDING,
    JobStatus.TRANSCRIBING,
    JobStatus.DETECTING_HIGHLIGHTS,
    JobStatus.CUTTING_CLIPS,
  ];
  return jobs.filter((j) => active.includes(j.status));
}

export function getFailedJobs(jobs: Job[]): Job[] {
  return jobs.filter((j) => j.status === JobStatus.FAILED);
}

export const STATUS_META: Record<
  JobStatus,
  { label: string; dot: string; chip: string }
> = {
  [JobStatus.PENDING]: {
    label: "Pending",
    dot: "bg-muted-foreground/50",
    chip: "bg-muted text-muted-foreground",
  },
  [JobStatus.TRANSCRIBING]: {
    label: "Transcribing",
    dot: "bg-chart-2",
    chip: "bg-chart-2/15 text-chart-2",
  },
  [JobStatus.DETECTING_HIGHLIGHTS]: {
    label: "Detecting highlights",
    dot: "bg-chart-4",
    chip: "bg-chart-4/15 text-chart-4",
  },
  [JobStatus.CUTTING_CLIPS]: {
    label: "Cutting clips",
    dot: "bg-chart-5",
    chip: "bg-chart-5/15 text-chart-5",
  },
  [JobStatus.COMPLETED]: {
    label: "Completed",
    dot: "bg-chart-1",
    chip: "bg-chart-1/15 text-chart-1",
  },
  [JobStatus.FAILED]: {
    label: "Failed",
    dot: "bg-destructive",
    chip: "bg-destructive/10 text-destructive",
  },
};

export function platformIcon(platform: SourcePlatform, className = "h-4 w-4") {
  switch (platform) {
    case SourcePlatform.YOUTUBE:
      return <YoutubeIcon className={cn(className, "text-[#FF0000]")} />;
    case SourcePlatform.TIKTOK:
      return <TiktokIcon className={className} />;
    case SourcePlatform.INSTAGRAM:
      return <InstagramIcon className={className} />;
    case SourcePlatform.UPLOAD:
      return <UploadIcon className={className} />;
    default:
      return <UploadIcon className={className} />;
  }
}

/* -------------------------------------------------------------------------- */
/*                         Pipeline step helpers                              */
/* -------------------------------------------------------------------------- */

export type PipelineStepState = "done" | "active" | "pending";

export const PIPELINE_STEPS: {
  key: JobStatus;
  label: string;
}[] = [
  { key: JobStatus.PENDING, label: "Download" },
  { key: JobStatus.TRANSCRIBING, label: "Transcribe" },
  { key: JobStatus.DETECTING_HIGHLIGHTS, label: "Detect highlights" },
  { key: JobStatus.CUTTING_CLIPS, label: "Cut & caption" },
  { key: JobStatus.COMPLETED, label: "Done" },
];

export function getPipelineStepState(
  stepKey: JobStatus,
  currentStatus: JobStatus
): PipelineStepState {
  const stepIndex = PIPELINE_STEPS.findIndex((s) => s.key === stepKey);
  const currentIndex = PIPELINE_STEPS.findIndex((s) => s.key === currentStatus);

  if (currentStatus === JobStatus.FAILED) {
    return stepIndex < Math.max(0, currentIndex >= 0 ? currentIndex : 0)
      ? "done"
      : "pending";
  }
  if (currentIndex < 0) return "pending";
  if (stepIndex < currentIndex) return "done";
  if (stepIndex === currentIndex) return "active";
  return "pending";
}

export function isProcessingStatus(status: JobStatus): boolean {
  return (
    status === JobStatus.PENDING ||
    status === JobStatus.TRANSCRIBING ||
    status === JobStatus.DETECTING_HIGHLIGHTS ||
    status === JobStatus.CUTTING_CLIPS
  );
}

export function formatTimestamp(totalSeconds: number): string {
  if (!isFinite(totalSeconds) || totalSeconds < 0) totalSeconds = 0;
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (m >= 60) {
    const h = Math.floor(m / 60);
    const rm = m % 60;
    return `${pad(h)}:${pad(rm)}:${pad(s)}`;
  }
  return `${pad(m)}:${pad(s)}`;
}

/**
 * Extracts a high-resolution YouTube video thumbnail URL from a YouTube URL.
 */
export function getYouTubeThumbnail(
  url?: string | null,
  quality: "max" | "hq" | "mq" = "hq"
): string | null {
  if (!url) return null;
  try {
    const match = url.match(
      /(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|watch\?.+&v=|shorts\/))([\w-]{11})/
    );
    if (!match || !match[1]) return null;
    const videoId = match[1];
    if (quality === "max") {
      return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    if (quality === "hq") {
      return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`;
    }
    return `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`;
  } catch {
    return null;
  }
}

/**
 * Returns a thumbnail for any job, preferring stored thumbnailUrl from backend,
 * extracted YouTube thumbnails, or fallback.
 */
export function getJobThumbnail(
  job: Pick<Job, "sourceUrl" | "sourcePlatform" | "thumbnailUrl">
): string | null {
  if (job.thumbnailUrl && job.thumbnailUrl.trim()) {
    return job.thumbnailUrl;
  }
  if (
    job.sourcePlatform === SourcePlatform.YOUTUBE ||
    job.sourceUrl?.includes("youtube") ||
    job.sourceUrl?.includes("youtu.be")
  ) {
    return getYouTubeThumbnail(job.sourceUrl, "hq");
  }
  return null;
}

/**
 * Formats duration of a job based on videoDuration, transcript segments or clips.
 */
export function getJobDurationFormatted(
  job: Pick<Job, "transcript" | "clips" | "videoDuration">
): string {
  if (typeof job.videoDuration === "number" && job.videoDuration > 0) {
    return formatTimestamp(job.videoDuration);
  }
  if (job.transcript && job.transcript.length > 0) {
    const lastSegment = job.transcript[job.transcript.length - 1];
    if (lastSegment && lastSegment.endTime > 0) {
      return formatTimestamp(lastSegment.endTime);
    }
  }
  if (job.clips && job.clips.length > 0) {
    const maxEnd = Math.max(...job.clips.map((c) => c.endTime || 0));
    if (maxEnd > 0) return formatTimestamp(maxEnd);
  }
  return "0:45";
}


export interface JobStageDetails {
  stageNumber: number;
  totalStages: number;
  title: string;
  subtitle: string;
  defaultPercent: number;
}

export function getJobStageDetails(status: JobStatus, progressPercent?: number): JobStageDetails {
  switch (status) {
    case JobStatus.PENDING:
      return {
        stageNumber: 1,
        totalStages: 5,
        title: "Ingesting stream & preparing audio buffers",
        subtitle: "Connecting to media source and verifying codecs",
        defaultPercent: progressPercent ?? 15,
      };
    case JobStatus.TRANSCRIBING:
      return {
        stageNumber: 2,
        totalStages: 5,
        title: "Transcribing speech & analyzing timestamps",
        subtitle: "Whisper AI speech-to-text with word-level alignment",
        defaultPercent: progressPercent ?? 40,
      };
    case JobStatus.DETECTING_HIGHLIGHTS:
      return {
        stageNumber: 3,
        totalStages: 5,
        title: "Detecting high-salience emotional hooks & speech cadence",
        subtitle: "Evaluating virality scores, punchlines, and retention hooks",
        defaultPercent: progressPercent ?? 68,
      };
    case JobStatus.CUTTING_CLIPS:
      return {
        stageNumber: 4,
        totalStages: 5,
        title: "Burning dynamic typography & 9:16 vertical re-framing",
        subtitle: "FFmpeg render pipeline with animated caption presets",
        defaultPercent: progressPercent ?? 88,
      };
    case JobStatus.COMPLETED:
      return {
        stageNumber: 5,
        totalStages: 5,
        title: "Render complete · Ready for export",
        subtitle: "All vertical clips optimized and ready to publish",
        defaultPercent: 100,
      };
    case JobStatus.FAILED:
    default:
      return {
        stageNumber: 0,
        totalStages: 5,
        title: "Processing encountered an issue",
        subtitle: "Click retry to re-queue the pipeline",
        defaultPercent: 0,
      };
  }
}

