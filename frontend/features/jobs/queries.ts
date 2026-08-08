import {
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
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
  list: () => [...jobsQueryKeys.lists()] as const,
  details: () => [...jobsQueryKeys.all, "detail"] as const,
  detail: (id: string) => [...jobsQueryKeys.details(), id] as const,
};

/* -------------------------------------------------------------------------- */
/*                                Types                                       */
/* -------------------------------------------------------------------------- */

export interface CreateJobInput {
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
}

export interface Job {
  id: string;
  sourceUrl: string;
  sourcePlatform: SourcePlatform;
  status: JobStatus;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

/* -------------------------------------------------------------------------- */
/*                           useJobs — GET /jobs                              */
/* -------------------------------------------------------------------------- */

export function useJobs(
  opts?: Omit<UseQueryOptions<Job[], Error>, "queryKey" | "queryFn">
): UseQueryResult<Job[], Error> {
  return useQuery({
    queryKey: jobsQueryKeys.list(),
    queryFn: async () => {
      const { data } = await axiosClient.get<Job[]>("/jobs");
      return data;
    },
    staleTime: 1000 * 10,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                         useJob(id) — GET /jobs/:id                         */
/* -------------------------------------------------------------------------- */

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
      const { data } = await axiosClient.post<Job>("/jobs", input);
      return data;
    },
    onSuccess: (...args: any[]) => {
      const data = args[0] as Job;
      queryClient.invalidateQueries({ queryKey: jobsQueryKeys.list() });
      queryClient.setQueryData(jobsQueryKeys.detail(data.id), data);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}
