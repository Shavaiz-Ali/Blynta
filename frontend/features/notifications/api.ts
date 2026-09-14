import { axiosClient } from "@/config/axiosClient";
import type {
  DeleteNotificationResult,
  ListNotificationsOptions,
  ListNotificationsResult,
  MarkAllAsReadResult,
  Notification,
  UnreadCountResult,
} from "./types";

export async function fetchNotifications(
  options: ListNotificationsOptions = {}
): Promise<ListNotificationsResult> {
  const { data } = await axiosClient.get<ListNotificationsResult>(
    "/notifications",
    { params: options }
  );
  return data;
}

export async function fetchUnreadCount(): Promise<UnreadCountResult> {
  const { data } = await axiosClient.get<UnreadCountResult>(
    "/notifications/unread-count"
  );
  return data;
}

export async function markNotificationAsRead(
  notificationId: string
): Promise<Notification> {
  const { data } = await axiosClient.patch<Notification>(
    `/notifications/${notificationId}/read`
  );
  return data;
}

export async function markAllNotificationsAsRead(): Promise<MarkAllAsReadResult> {
  const { data } = await axiosClient.patch<MarkAllAsReadResult>(
    "/notifications/read-all"
  );
  return data;
}

export async function deleteNotification(
  notificationId: string
): Promise<DeleteNotificationResult> {
  const { data } = await axiosClient.delete<DeleteNotificationResult>(
    `/notifications/${notificationId}`
  );
  return data;
}
