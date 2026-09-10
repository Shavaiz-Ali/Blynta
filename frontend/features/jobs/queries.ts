import {
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
  Query,
} from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import {
  SourcePlatform,
  JobStatus,
  TranscriptSegment,
  Highlight,
  Clip,
  StylePresetInfo,
  CreateJobInput,
  Job,
  JobsListParams,
  JobsListResult,
} from "./types";

export {
  SourcePlatform,
  JobStatus,
};
export type {
  TranscriptSegment,
  Highlight,
  Clip,
  StylePresetInfo,
  CreateJobInput,
  Job,
  JobsListParams,
  JobsListResult,
};

/* -------------------------------------------------------------------------- */
/*                              Query keys                                    */
/* -------------------------------------------------------------------------- */

export const jobsQueryKeys = {
  all: ["jobs"] as const,
  lists: () => [...jobsQueryKeys.all, "list"] as const,
  list: (params?: JobsListParams) => [...jobsQueryKeys.lists(), params] as const,
  details: () => [...jobsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...jobsQueryKeys.details(), id] as const,
};

/* -------------------------------------------------------------------------- */
/*                  useJobs — GET /jobs (paginated + filtered)                */
/* -------------------------------------------------------------------------- */

export function useJobs(
  params?: JobsListParams,
  opts?: Omit<UseQueryOptions<JobsListResult, Error>, "queryKey" | "queryFn">
): UseQueryResult<JobsListResult, Error> {
  return useQuery({
    queryKey: jobsQueryKeys.list(params),
    queryFn: async () => {
      const { data } = await axiosClient.get<JobsListResult>("/jobs", {
        params,
      });
      return data;
    },
    staleTime: 1000 * 10,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                         useJob(id) — GET /jobs/:id                         */
/* -------------------------------------------------------------------------- */

const ACTIVE_JOB_STATUSES: JobStatus[] = [
  JobStatus.PENDING,
  JobStatus.TRANSCRIBING,
  JobStatus.DETECTING_HIGHLIGHTS,
  JobStatus.CUTTING_CLIPS,
];

export function useJob(
  id: string,
  opts?: Omit<UseQueryOptions<Job, Error>, "queryKey" | "queryFn">
): UseQueryResult<Job, Error> {
  return useQuery({
    queryKey: jobsQueryKeys.detail(id),
    queryFn: async () => {
      const { data } = await axiosClient.get<Job>(`/jobs/${id}`);
      return data;
    },
    enabled: Boolean(id),
    staleTime: 1000 * 10,
    refetchInterval: (query: Query<Job, Error>) => {
      const status = query.state.data?.status;
      if (status && ACTIVE_JOB_STATUSES.includes(status)) {
        return 4000;
      }
      return false;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                       useCreateJob — POST /jobs                            */
/* -------------------------------------------------------------------------- */

type CreateJobOpts = Omit<
  UseMutationOptions<Job, Error, CreateJobInput, unknown>,
  "mutationFn"
>;

export function useCreateJob(
  opts: CreateJobOpts = {}
): UseMutationResult<Job, Error, CreateJobInput, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async (input: CreateJobInput) => {
      const body: Record<string, unknown> = {
        sourceUrl: input.sourceUrl,
        sourcePlatform: input.sourcePlatform,
      };
      if (input.customPrompt && input.customPrompt.trim().length > 0) {
        body.customPrompt = input.customPrompt.trim();
      }
      if (input.aiModel && input.aiModel !== "default") {
        body.aiModel = input.aiModel;
      }
      if (input.stylePreset && input.stylePreset !== "default") {
        body.stylePreset = input.stylePreset;
      }
      const { data } = await axiosClient.post<Job>("/jobs", body);
      return data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.setQueryData(jobsQueryKeys.detail(data.id), data);
      if (userOnSuccess) (userOnSuccess as (d: typeof data, v: typeof variables, c: typeof context) => void)(data, variables, context);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*                  useStylePresets — GET /style-presets                      */
/* -------------------------------------------------------------------------- */

export function useStylePresets(
  opts?: Omit<UseQueryOptions<StylePresetInfo[], Error>, "queryKey" | "queryFn">
): UseQueryResult<StylePresetInfo[], Error> {
  return useQuery({
    queryKey: ["style-presets"],
    queryFn: async () => {
      const { data } = await axiosClient.get<StylePresetInfo[]>("/style-presets");
      return data;
    },
    staleTime: 1000 * 60 * 60,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                  useDownloadClip — GET /jobs/:id/clips/:id/download        */
/* -------------------------------------------------------------------------- */

type DownloadClipOpts = Omit<
  UseMutationOptions<{ signedUrl: string }, Error, { jobId: string; clipId: string }, unknown>,
  "mutationFn"
>;

export function useDownloadClip(
  opts: DownloadClipOpts = {}
): UseMutationResult<{ signedUrl: string }, Error, { jobId: string; clipId: string }, unknown> {
  return useMutation({
    mutationFn: async ({ jobId, clipId }) => {
      const { data } = await axiosClient.get<{ signedUrl: string }>(
        `/jobs/${jobId}/clips/${clipId}/download`
      );
      return data;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*              useDeleteJob — DELETE /jobs/:id                               */
/* -------------------------------------------------------------------------- */

export function useDeleteJob(): UseMutationResult<
  { message: string },
  Error,
  string,
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await axiosClient.delete<{ message: string }>(
        `/jobs/${jobId}`
      );
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*         useDeleteClip — DELETE /jobs/:jobId/clips/:clipId                  */
/* -------------------------------------------------------------------------- */

export function useDeleteClip(): UseMutationResult<
  { message: string },
  Error,
  { jobId: string; clipId: string },
  unknown
> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      jobId,
      clipId,
    }: {
      jobId: string;
      clipId: string;
    }) => {
      const { data } = await axiosClient.delete<{ message: string }>(
        `/jobs/${jobId}/clips/${clipId}`
      );
      return data;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: jobsQueryKeys.detail(variables.jobId),
      });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
    },
  });
}

/* -------------------------------------------------------------------------- */
/*              useRetryJob — POST /jobs/:id/retry                            */
/* -------------------------------------------------------------------------- */

type RetryJobResponse = { jobId: string; status: string };

type RetryJobOpts = Omit<
  UseMutationOptions<RetryJobResponse, Error, string, unknown>,
  "mutationFn"
>;

export function useRetryJob(
  opts: RetryJobOpts = {}
): UseMutationResult<RetryJobResponse, Error, string, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await axiosClient.post<RetryJobResponse>(`/jobs/${jobId}/retry`);
      return data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.detail(data.jobId) });
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      if (userOnSuccess) (userOnSuccess as (d: typeof data, v: typeof variables, c: typeof context) => void)(data, variables, context);
    },
    ...restOpts,
  });
}
