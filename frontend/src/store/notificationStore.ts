import { create } from "zustand";
import type { Notification } from "@/types/notification";
import { notificationService } from "@/services/notification.service";

function countUnread(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;
  isLoading: boolean;
  loadError: string | null;

  initialize: (userId: string) => Promise<void>;
  refresh: (userId: string) => Promise<void>;
  markRead: (id: string, userId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  addNotification: (notification: Notification) => void;
}

export const useNotificationStore = create<NotificationState>()((set, get) => ({
  notifications: [],
  unreadCount: 0,
  isLoading: false,
  loadError: null,

  initialize: async (userId) => {
    if (get().isLoading) return;
    await get().refresh(userId);
  },

  refresh: async (userId) => {
    set({ isLoading: true, loadError: null });
    try {
      const notifications = await notificationService.list(userId);
      set({
        notifications,
        unreadCount: countUnread(notifications),
        isLoading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notifications";
      set({ isLoading: false, loadError: message });
    }
  },

  markRead: async (id, userId) => {
    try {
      await notificationService.markRead(id, userId);
    } catch (err) {
      // Surface error but still update locally so UI stays responsive
      console.error("[notificationStore] markRead failed", err);
    }
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications, unreadCount: countUnread(notifications) };
    });
  },

  markAllRead: async () => {
    try {
      await notificationService.markAllRead();
    } catch (err) {
      console.error("[notificationStore] markAllRead failed", err);
    }
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    }));
  },

  addNotification: (notification) =>
    set((state) => {
      const notifications = [notification, ...state.notifications];
      return { notifications, unreadCount: countUnread(notifications) };
    }),
}));
