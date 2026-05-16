import { create } from "zustand";
import type { Notification } from "@/types/notification";
import { mockNotifications } from "@/mocks/mockNotifications";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function countUnread(notifications: Notification[]): number {
  return notifications.filter((n) => !n.read).length;
}

// ─── State ────────────────────────────────────────────────────────────────────

interface NotificationState {
  notifications: Notification[];
  unreadCount: number;

  initialize: (userId: string) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
  addNotification: (notification: Notification) => void;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useNotificationStore = create<NotificationState>()((set) => ({
  notifications: [],
  unreadCount: 0,

  initialize: (userId) => {
    const notifications = mockNotifications.filter((n) => n.userId === userId);
    set({ notifications, unreadCount: countUnread(notifications) });
  },

  markRead: (id) =>
    set((state) => {
      const notifications = state.notifications.map((n) =>
        n.id === id ? { ...n, read: true } : n
      );
      return { notifications, unreadCount: countUnread(notifications) };
    }),

  markAllRead: () =>
    set((state) => ({
      notifications: state.notifications.map((n) => ({ ...n, read: true })),
      unreadCount: 0,
    })),

  addNotification: (notification) =>
    set((state) => {
      const notifications = [notification, ...state.notifications];
      return { notifications, unreadCount: countUnread(notifications) };
    }),
}));
