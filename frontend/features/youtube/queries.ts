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
  YouTubeCategory,
  ThumbnailPresignedResponse,
  ListPublicationsParams,
  UserPublicationsResponse,
} from "./types";

export const youtubeQueryKeys = {
  all: ["youtube"] as const,
  status: () => [...youtubeQueryKeys.all, "status"] as const,
  publications: (jobId: string, clipId: string) =>
    [...youtubeQueryKeys.all, "publications", jobId, clipId] as const,
  userPublications: (params?: ListPublicationsParams) =>
    [...youtubeQueryKeys.all, "userPublications", params] as const,
  categories: () => [...youtubeQueryKeys.all, "categories"] as const,
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
/*         useUserPublications — GET /youtube/publications                    */
/* -------------------------------------------------------------------------- */

export function useUserPublications(
  params?: ListPublicationsParams,
  opts?: Omit<UseQueryOptions<UserPublicationsResponse, Error>, "queryKey" | "queryFn">
): UseQueryResult<UserPublicationsResponse, Error> {
  return useQuery({
    queryKey: youtubeQueryKeys.userPublications(params),
    queryFn: async () => {
      const { data } = await axiosClient.get<{
        success: boolean;
        data?: UserPublicationsResponse;
      } & UserPublicationsResponse>("/youtube/publications", {
        params,
      });

      const payload = (data?.data ?? data) as UserPublicationsResponse;
      return payload;
    },
    refetchInterval: (query) => {
      const data = query.state.data;
      if (!data || !data.publications || data.publications.length === 0) return false;
      const hasActive = data.publications.some(
        (p) => p.status === "queued" || p.status === "uploading" || p.status === "processing"
      );
      return hasActive ? 4000 : false;
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

/* -------------------------------------------------------------------------- */
/*     useYouTubeCategories — GET /youtube/categories                         */
/* -------------------------------------------------------------------------- */

export function useYouTubeCategories(
  opts?: Omit<UseQueryOptions<YouTubeCategory[], Error>, "queryKey" | "queryFn">
): UseQueryResult<YouTubeCategory[], Error> {
  return useQuery({
    queryKey: youtubeQueryKeys.categories(),
    queryFn: async () => {
      const { data } = await axiosClient.get<{
        success: boolean;
        data?: { categories: YouTubeCategory[] };
      }>("/youtube/categories");
      return data?.data?.categories ?? [];
    },
    // Categories rarely change — cache for 30 minutes, re-use for up to 2 hours
    staleTime: 1000 * 60 * 30,
    gcTime: 1000 * 60 * 120,
    retry: 1, // Don't hammer the YouTube API on failure
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*     useUploadThumbnail — Upload thumbnail via presigned R2 URL             */
/* -------------------------------------------------------------------------- */

export interface UploadThumbnailInput {
  file: File;
}

export interface UploadThumbnailResult {
  thumbnailKey: string;
  /** Local blob URL for preview — only valid for the lifetime of this session. */
  previewUrl: string;
}

export function useUploadThumbnail(
  opts?: UseMutationOptions<UploadThumbnailResult, Error, UploadThumbnailInput>
): UseMutationResult<UploadThumbnailResult, Error, UploadThumbnailInput> {
  return useMutation({
    mutationFn: async ({ file }: UploadThumbnailInput) => {
      // Step 1: Get a presigned R2 PUT URL from our backend
      const { data: presignedData } = await axiosClient.post<{
        success: boolean;
        data?: ThumbnailPresignedResponse;
      }>("/youtube/thumbnails/presigned", { contentType: file.type });

      const { presignedUrl, thumbnailKey } =
        presignedData?.data ?? (presignedData as unknown as ThumbnailPresignedResponse);

      // Step 2: PUT the file directly to R2 using the presigned URL
      // We use native fetch here because this goes to R2, not our API server
      const uploadResponse = await fetch(presignedUrl, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!uploadResponse.ok) {
        throw new Error(
          `Thumbnail upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`
        );
      }

      // Step 3: Return the key (for the publish payload) and a local preview URL
      const previewUrl = URL.createObjectURL(file);

      return { thumbnailKey, previewUrl };
    },
    ...opts,
  });
}
