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

/* -------------------------------------------------------------------------- */
/*                              Enums (matches backend)                       */
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
/*                                Types                                       */
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
}

export interface Clip {
  id: string;
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
  _id: string;
}

export interface CreateJobInput {
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  customPrompt?: string;
  aiModel?: string;
}

export interface Job {
  id: string;
  _id: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  status: JobStatus;
  errorMessage?: string | null;
  errorStage?: string | null;
  progressPercent?: number;
  resolutionUsed?: string;
  localVideoPath?: string;
  localAudioPath?: string;
  customPrompt?: string;
  aiModel?: string;
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
      const { data } = await axiosClient.post<Job>("/jobs", body);
      return data;
    },
    onSuccess: (...args: any[]) => {
      const data = args[0] as Job;
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.setQueryData(jobsQueryKeys.detail(data.id), data);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*                  useDownloadClip — GET /jobs/:id/clips/:id/download        */
/* -------------------------------------------------------------------------- */

type DownloadClipOpts = Omit<
  UseMutationOptions<Blob, Error, { jobId: string; clipId: string }, unknown>,
  "mutationFn"
>;

export function useDownloadClip(
  opts: DownloadClipOpts = {}
): UseMutationResult<Blob, Error, { jobId: string; clipId: string }, unknown> {
  return useMutation({
    mutationFn: async ({ jobId, clipId }) => {
      const response = await axiosClient.get(
        `/jobs/${jobId}/clips/${clipId}/download`,
        {
          responseType: "blob",
        }
      );
      return response.data as Blob;
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

export function useRetryJob(): UseMutationResult<Job, Error, string, unknown> {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (jobId: string) => {
      const { data } = await axiosClient.post<Job>(`/jobs/${jobId}/retry`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.lists() });
      queryClient.invalidateQueries({ queryKey: ["users", "me"] });
    },
  });
}
