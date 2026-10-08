import type { Job, Clip } from "./types";

export const processingSteps = [
  { status: "pending", label: "Preparing video" },
  { status: "transcribing", label: "Generating transcript" },
  { status: "detecting_highlights", label: "Finding the best moments" },
  { status: "cutting_clips", label: "Creating your clips" },
] as const;

export function pipelineIndex(job: Job) {
  if (completedWithIssues(job)) return processingSteps.length;
  if (job.status === "completed") return processingSteps.length;
  const stage = job.status === "failed" ? job.errorStage : job.status;
  const aliases: Record<string, string> = {
    download: "pending",
    transcription: "transcribing",
    highlight_detection: "detecting_highlights",
    cutting: "cutting_clips",
    captioning: "cutting_clips",
    uploading: "cutting_clips",
    rendering: "cutting_clips",
  };
  return processingSteps.findIndex(
    (step) => step.status === (aliases[stage ?? ""] ?? stage),
  );
}

export function completedWithIssues(job: Job) {
  const clips = job.clips ?? [];
  return (
    clips.length > 0 &&
    clips.some((clip) => clip.status === "failed") &&
    clips.every(
      (clip) => clip.status === "completed" || clip.status === "failed",
    )
  );
}

export function clipState(job: Job, clip: Clip) {
  const progress = job.render?.clips.find(
    (entry) => entry.clipId === (clip._id || clip.id),
  );
  const status =
    clip.status === "completed"
      ? "ready"
      : clip.status === "failed"
        ? "failed"
        : (progress?.status ?? clip.processingState ?? "queued");
  return { status, progress };
}

export function percentage(value: number | undefined) {
  return value !== undefined && Number.isFinite(value)
    ? Math.round(Math.max(0, Math.min(100, value)))
    : undefined;
}

export function processingPollInterval(status: string | undefined) {
  if (status === "cutting_clips") return 1000;
  return ["pending", "transcribing", "detecting_highlights"].includes(
    status ?? "",
  )
    ? 3500
    : false;
}
