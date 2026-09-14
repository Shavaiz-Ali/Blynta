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
import type {
  DeleteNotificationResult,
  ListNotificationsOptions,
  ListNotificationsResult,
  MarkAllAsReadResult,
  Notification,
  UnreadCountResult,
} from "./types";
import {
  deleteNotification,
  fetchNotifications,
  fetchUnreadCount,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "./api";

export const notificationQueryKeys = {
  all: ["notifications"] as const,
  list: (options: ListNotificationsOptions = {}) =>
    [...notificationQueryKeys.all, "list", options] as const,
  unreadCount: () => [...notificationQueryKeys.all, "unread-count"] as const,
};

export function useNotificationsQuery(
  options: ListNotificationsOptions = {},
  opts?: Omit<
    UseQueryOptions<ListNotificationsResult, Error>,
    "queryKey" | "queryFn"
  >
): UseQueryResult<ListNotificationsResult, Error> {
  return useQuery({
    queryKey: notificationQueryKeys.list(options),
    queryFn: () => fetchNotifications(options),
    staleTime: 1000 * 30,
    ...opts,
  });
}

export function useUnreadCountQuery(
  opts?: Omit<
    UseQueryOptions<UnreadCountResult, Error>,
    "queryKey" | "queryFn"
  >
): UseQueryResult<UnreadCountResult, Error> {
  return useQuery({
    queryKey: notificationQueryKeys.unreadCount(),
    queryFn: fetchUnreadCount,
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    ...opts,
  });
}

type MarkAsReadOpts = Omit<
  UseMutationOptions<Notification, Error, string, unknown>,
  "mutationFn"
>;

export function useMarkAsReadMutation(
  opts: MarkAsReadOpts = {}
): UseMutationResult<Notification, Error, string, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: (notificationId: string) => markNotificationAsRead(notificationId),
    onSuccess: (...args: any[]) => {
      invalidateNotifications(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

type MarkAllAsReadOpts = Omit<
  UseMutationOptions<MarkAllAsReadResult, Error, void, unknown>,
  "mutationFn"
>;

export function useMarkAllAsReadMutation(
  opts: MarkAllAsReadOpts = {}
): UseMutationResult<MarkAllAsReadResult, Error, void, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: () => markAllNotificationsAsRead(),
    onSuccess: (...args: any[]) => {
      invalidateNotifications(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

type DeleteNotificationOpts = Omit<
  UseMutationOptions<DeleteNotificationResult, Error, string, unknown>,
  "mutationFn"
>;

export function useDeleteNotificationMutation(
  opts: DeleteNotificationOpts = {}
): UseMutationResult<DeleteNotificationResult, Error, string, unknown> {
  const queryClient = useQueryClient();
  const { onSuccess: userOnSuccess, ...restOpts } = opts;
  return useMutation({
    mutationFn: (notificationId: string) => deleteNotification(notificationId),
    onSuccess: (...args: any[]) => {
      invalidateNotifications(queryClient);
      if (userOnSuccess) (userOnSuccess as any)(...args);
    },
    ...restOpts,
  });
}

export function invalidateNotifications(queryClient: QueryClient) {
  queryClient.invalidateQueries({ queryKey: notificationQueryKeys.all });
}
