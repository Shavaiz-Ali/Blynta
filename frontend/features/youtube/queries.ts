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
import {
  YouTubeStatusResponse,
  ClipPublication,
  PublishToYouTubeInput,
} from "./types";

export const youtubeQueryKeys = {
  all: ["youtube"] as const,
  status: () => [...youtubeQueryKeys.all, "status"] as const,
  publications: (jobId: string, clipId: string) =>
    [...youtubeQueryKeys.all, "publications", jobId, clipId] as const,
};

/* -------------------------------------------------------------------------- */
/*             useYouTubeStatus — GET /youtube/status                         */
/* -------------------------------------------------------------------------- */

export function useYouTubeStatus(
  opts?: Omit<UseQueryOptions<YouTubeStatusResponse, Error>, "queryKey" | "queryFn">
): UseQueryResult<YouTubeStatusResponse, Error> {
  return useQuery({
    queryKey: youtubeQueryKeys.status(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{
        success: boolean;
        data?: YouTubeStatusResponse;
      } & YouTubeStatusResponse>("/youtube/status");
      // Backend response interceptor unwraps to data.data or returns payload directly
      return (data?.data ?? data) as YouTubeStatusResponse;
    },
    staleTime: 1000 * 60, // 1 minute
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*             usePublications — GET /jobs/:jobId/clips/:clipId/publications  */
/* -------------------------------------------------------------------------- */

export function usePublications(
  jobId: string,
  clipId: string,
  opts?: Omit<UseQueryOptions<ClipPublication[], Error>, "queryKey" | "queryFn">
): UseQueryResult<ClipPublication[], Error> {
  return useQuery({
    queryKey: youtubeQueryKeys.publications(jobId, clipId),
    queryFn: async () => {
      const { data } = await axiosClient.get<{
        success: boolean;
        data?: { publications: ClipPublication[] };
        publications?: ClipPublication[];
      }>(`/jobs/${jobId}/clips/${clipId}/publications`);

      const payload = data?.data ?? data;
      return payload?.publications ?? [];
    },
    enabled: Boolean(jobId && clipId),
    refetchInterval: (query) => {
      const publications = query.state.data;
      if (!publications || publications.length === 0) return false;
      const hasActive = publications.some(
        (p) => p.status === "queued" || p.status === "uploading" || p.status === "processing"
      );
      return hasActive ? 3000 : false;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*             useConnectYouTube — GET /youtube/connect                       */
/* -------------------------------------------------------------------------- */

export function useConnectYouTube(
  opts?: UseMutationOptions<{ url: string }, Error, void>
): UseMutationResult<{ url: string }, Error, void> {
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.get<{
        success: boolean;
        data: { url: string };
      }>("/youtube/connect");
      return data?.data ?? data;
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*             useDisconnectYouTube — DELETE /youtube/connection              */
/* -------------------------------------------------------------------------- */

export function useDisconnectYouTube(
  opts?: UseMutationOptions<void, Error, void>
): UseMutationResult<void, Error, void> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      await axiosClient.delete("/youtube/connection");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: youtubeQueryKeys.status() });
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*     usePublishToYouTube — POST /jobs/:jobId/clips/:clipId/publications/youtube */
/* -------------------------------------------------------------------------- */

export function usePublishToYouTube(
  jobId: string,
  clipId: string,
  opts?: UseMutationOptions<
    { success: boolean; publication: Partial<ClipPublication> },
    Error,
    PublishToYouTubeInput
  >
): UseMutationResult<
  { success: boolean; publication: Partial<ClipPublication> },
  Error,
  PublishToYouTubeInput
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: PublishToYouTubeInput) => {
      const { data } = await axiosClient.post<{
        success: boolean;
        data?: { success: boolean; publication: Partial<ClipPublication> };
        publication?: Partial<ClipPublication>;
      }>(`/jobs/${jobId}/clips/${clipId}/publications/youtube`, input);

      const payload = data?.data ?? data;
      return payload as { success: boolean; publication: Partial<ClipPublication> };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: youtubeQueryKeys.publications(jobId, clipId),
      });
    },
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*     useRetryPublication — POST /jobs/:jobId/clips/:clipId/publications/:id/retry */
/* -------------------------------------------------------------------------- */

export function useRetryPublication(
  jobId: string,
  clipId: string,
  opts?: UseMutationOptions<
    { success: boolean; publication: Partial<ClipPublication> },
    Error,
    string
  >
): UseMutationResult<
  { success: boolean; publication: Partial<ClipPublication> },
  Error,
  string
> {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (publicationId: string) => {
      const { data } = await axiosClient.post<{
        success: boolean;
        data?: { success: boolean; publication: Partial<ClipPublication> };
        publication?: Partial<ClipPublication>;
      }>(`/jobs/${jobId}/clips/${clipId}/publications/${publicationId}/retry`);

      const payload = data?.data ?? data;
      return payload as { success: boolean; publication: Partial<ClipPublication> };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: youtubeQueryKeys.publications(jobId, clipId),
      });
    },
    ...opts,
  });
}
