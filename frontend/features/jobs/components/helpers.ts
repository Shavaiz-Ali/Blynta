import { Clip, Job } from "@/features/jobs/types";

export function getClipId(clip?: Clip | any): string {
  if (!clip) return "";
  return clip._id ?? clip.id ?? "";
}

export function getJobId(job?: Job | any): string {
  if (!job) return "";
  return job.id ?? job._id ?? "";
}
