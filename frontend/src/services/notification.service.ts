import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";
import type { Notification } from "@/types/notification";

interface ApiNotification {
  id: string;
  notification_type: string;
  title: string;
  body: string;
  is_read: boolean;
  read_at?: string | null;
  deep_link?: string | null;
  related_goal_id?: string | null;
  created_at: string;
}

interface ApiPaginated<T> {
  items: T[];
  meta?: unknown;
}

const ALLOWED_TYPES = new Set(["info", "warning", "success", "action"]);

function mapType(value: string): Notification["type"] {
  return (ALLOWED_TYPES.has(value) ? value : "info") as Notification["type"];
}

function mapApiNotification(n: ApiNotification, userId: string): Notification {
  return {
    id: n.id,
    userId,
    title: n.title,
    message: n.body,
    type: mapType(n.notification_type),
    read: n.is_read,
    actionUrl: n.deep_link ?? undefined,
    createdAt: n.created_at,
  };
}

function unwrap<T>(resp: APIResponse<T>, fallback: string): T {
  if (!resp.success || resp.data === null || resp.data === undefined) {
    throw new Error(resp.error?.message ?? fallback);
  }
  return resp.data;
}

export const notificationService = {
  list: async (userId: string, page = 1, pageSize = 50): Promise<Notification[]> => {
    const resp = await apiClient.get<APIResponse<ApiPaginated<ApiNotification>>>(
      `/v1/notifications/?page=${page}&page_size=${pageSize}`
    );
    const data = unwrap(resp, "Failed to load notifications");
    return data.items.map((n) => mapApiNotification(n, userId));
  },

  unreadCount: async (): Promise<number> => {
    const resp = await apiClient.get<APIResponse<{ count: number }>>(
      "/v1/notifications/unread-count"
    );
    return unwrap(resp, "Failed to load unread count").count;
  },

  markRead: async (id: string, userId: string): Promise<Notification> => {
    const resp = await apiClient.patch<APIResponse<ApiNotification>>(
      `/v1/notifications/${id}/read`,
      {}
    );
    return mapApiNotification(unwrap(resp, "Failed to mark as read"), userId);
  },

  markAllRead: async (): Promise<number> => {
    const resp = await apiClient.post<APIResponse<{ marked_read: number }>>(
      "/v1/notifications/mark-all-read",
      {}
    );
    return unwrap(resp, "Failed to mark all read").marked_read;
  },
};
