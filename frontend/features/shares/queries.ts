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
  ShareView,
  CreateShareInput,
  CreateShareResult,
  UpdateShareInput,
  PublicShareResponse,
} from "./types";

export const sharesQueryKeys = {
  all: ["shares"] as const,
  list: (clipId?: string) => [...sharesQueryKeys.all, "list", clipId] as const,
  detail: (id: string) => [...sharesQueryKeys.all, "detail", id] as const,
  public: (token: string) => [...sharesQueryKeys.all, "public", token] as const,
};

/* -------------------------------------------------------------------------- */
/*             useShares — GET /shares (optionally filtered by clipId)        */
/* -------------------------------------------------------------------------- */

export function useShares(
  clipId?: string,
  opts?: Omit<UseQueryOptions<ShareView[], Error>, "queryKey" | "queryFn">
): UseQueryResult<ShareView[], Error> {
  return useQuery({
    queryKey: sharesQueryKeys.list(clipId),
    queryFn: async () => {
      const { data } = await axiosClient.get<ShareView[]>("/shares", {
        params: clipId ? { clipId } : undefined,
      });
      return data;
    },
    enabled: clipId !== undefined ? Boolean(clipId) : true,
    staleTime: 1000 * 30,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*             usePublicShare — GET /shares/public/:token                     */
/* -------------------------------------------------------------------------- */

export function usePublicShare(
  token: string,
  opts?: Omit<UseQueryOptions<PublicShareResponse, Error>, "queryKey" | "queryFn">
): UseQueryResult<PublicShareResponse, Error> {
  return useQuery({
    queryKey: sharesQueryKeys.public(token),
    queryFn: async () => {
      const { data } = await axiosClient.get<PublicShareResponse>(
        `/shares/public/${token}`
      );
      return data;
    },
    enabled: Boolean(token),
    staleTime: 1000 * 60 * 10, // 10 min cache
    retry: false,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*             useCreateShare — POST /shares                                  */
/* -------------------------------------------------------------------------- */

type CreateShareOpts = Omit<
  UseMutationOptions<CreateShareResult, Error, CreateShareInput, unknown>,
  "mutationFn"
>;

export function useCreateShare(
  opts: CreateShareOpts = {}
): UseMutationResult<CreateShareResult, Error, CreateShareInput, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;

  return useMutation({
    mutationFn: async (input: CreateShareInput) => {
      const { data } = await axiosClient.post<CreateShareResult>(
        "/shares",
        input
      );
      return data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({
        queryKey: sharesQueryKeys.list(variables.clipId),
      });
      queryClient.invalidateQueries({
        queryKey: sharesQueryKeys.all,
      });
      if (userOnSuccess) {
        (
          userOnSuccess as (
            d: typeof data,
            v: typeof variables,
            c: typeof context
          ) => void
        )(data, variables, context);
      }
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*             useUpdateShare — PATCH /shares/:id                             */
/* -------------------------------------------------------------------------- */

type UpdateShareOpts = Omit<
  UseMutationOptions<
    ShareView,
    Error,
    { shareId: string; input: UpdateShareInput; clipId?: string },
    unknown
  >,
  "mutationFn"
>;

export function useUpdateShare(
  opts: UpdateShareOpts = {}
): UseMutationResult<
  ShareView,
  Error,
  { shareId: string; input: UpdateShareInput; clipId?: string },
  unknown
> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;

  return useMutation({
    mutationFn: async ({ shareId, input }) => {
      const { data } = await axiosClient.patch<ShareView>(
        `/shares/${shareId}`,
        input
      );
      return data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: sharesQueryKeys.all });
      if (userOnSuccess) {
        (
          userOnSuccess as (
            d: typeof data,
            v: typeof variables,
            c: typeof context
          ) => void
        )(data, variables, context);
      }
    },
    ...restOpts,
  });
}

/* -------------------------------------------------------------------------- */
/*             useRevokeShare — DELETE /shares/:id                            */
/* -------------------------------------------------------------------------- */

type RevokeShareOpts = Omit<
  UseMutationOptions<
    { message: string },
    Error,
    { shareId: string; clipId?: string },
    unknown
  >,
  "mutationFn"
>;

export function useRevokeShare(
  opts: RevokeShareOpts = {}
): UseMutationResult<
  { message: string },
  Error,
  { shareId: string; clipId?: string },
  unknown
> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;

  return useMutation({
    mutationFn: async ({ shareId }) => {
      const { data } = await axiosClient.delete<{ message: string }>(
        `/shares/${shareId}`
      );
      return data;
    },
    onSuccess: (data, variables, context) => {
      queryClient.invalidateQueries({ queryKey: sharesQueryKeys.all });
      if (userOnSuccess) {
        (
          userOnSuccess as (
            d: typeof data,
            v: typeof variables,
            c: typeof context
          ) => void
        )(data, variables, context);
      }
    },
    ...restOpts,
  });
}
