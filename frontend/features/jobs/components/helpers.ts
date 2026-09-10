import { Clip, Job } from "@/features/jobs/types";

export function getClipId(clip?: Clip | { id?: string; _id?: string } | null): string {
  if (!clip) return "";
  return clip._id ?? clip.id ?? "";
}

export function getJobId(job?: Job | { id?: string; _id?: string } | null): string {
  if (!job) return "";
  return job.id ?? job._id ?? "";
}

