import {
  QueryClient,
  useMutation,
  UseMutationOptions,
  UseMutationResult,
  useQuery,
  useQueryClient,
  UseQueryOptions,
  UseQueryResult,
} from "@tanstack/react-query";
import { axiosClient } from "@/config/axiosClient";
import type { UserProfile } from "@/features/auth/types";

/* -------------------------------------------------------------------------- */
/*                              Query keys                                    */
/* -------------------------------------------------------------------------- */

export const userQueryKeys = {
  all: ["user"] as const,
  me: () => [...userQueryKeys.all, "me"] as const,
};

/* -------------------------------------------------------------------------- */
/*                                Types                                       */
/* -------------------------------------------------------------------------- */

export type MarkWelcomedResult = { message: string };

/* -------------------------------------------------------------------------- */
/*                           useCurrentUser — GET /users/me                   */
/* -------------------------------------------------------------------------- */

export function useCurrentUser(
  opts?: Omit<UseQueryOptions<UserProfile, Error>, "queryKey" | "queryFn">
): UseQueryResult<UserProfile, Error> {
  return useQuery({
    queryKey: userQueryKeys.me(),
    queryFn: async () => {
      const { data } = await axiosClient.get<UserProfile>("/users/me");
      return data;
    },
    staleTime: 1000 * 30,
    ...opts,
  });
}

/* -------------------------------------------------------------------------- */
/*                       useMarkWelcomed — PATCH /users/me/welcomed           */
/* -------------------------------------------------------------------------- */

type MarkWelcomedOpts = Omit<
  UseMutationOptions<MarkWelcomedResult, Error, void, unknown>,
  "mutationFn"
>;

export function useMarkWelcomed(
  opts: MarkWelcomedOpts = {}
): UseMutationResult<MarkWelcomedResult, Error, void, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: async () => {
      const { data } = await axiosClient.patch<MarkWelcomedResult>(
        "/users/me/welcomed"
      );
      return data;
    },
    onSuccess: (...args: any[]) => {
      invalidateCurrentUser(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

export function invalidateCurrentUser(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: userQueryKeys.me() });
}
