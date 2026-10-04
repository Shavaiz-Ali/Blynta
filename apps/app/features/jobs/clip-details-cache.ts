import type { QueryClient } from "@tanstack/react-query";
import type { Job, JobsListResult } from "./types";

/** List jobs contain embedded clip details; reuse only an exact clip match. */
export function cachedClipJob(
  client: QueryClient,
  jobId: string,
  clipId: string,
): Job | undefined {
  const job = client
    .getQueriesData<JobsListResult>({ queryKey: ["jobs", "list"] })
    .flatMap(([, data]) => data?.jobs || [])
    .filter(
      (item) =>
        (item.id || item._id) === jobId &&
        item.clips?.some((clip) => (clip._id || clip.id) === clipId),
    )
    .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))[0];
  return job;
}
