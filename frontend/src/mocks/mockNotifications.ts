import type { Notification } from "@/types/notification";

// ─── Notifications ────────────────────────────────────────────────────────────
// 4 sample in-app notifications — one set per role.

// Employee notifications (for Rahul)
export const EMPLOYEE_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-e-001",
    userId: "u-rahul-verma",
    targetRole: "employee",
    title: "Goal Sheet Due Soon",
    message:
      "The FY2026 goal-setting window closes on 31 May 2026. You have 1 draft goal. Submit your goal sheet before the deadline.",
    type: "warning",
    read: false,
    actionUrl: "/employee/goals",
    createdAt: "2026-05-14T08:00:00.000Z",
  },
  {
    id: "notif-e-002",
    userId: "u-rahul-verma",
    targetRole: "employee",
    title: "Goal Target Updated",
    message:
      "Your manager Vikram Nair updated the target for 'Achieve Q1 Sales Revenue Target' from ₹45L to ₹50L.",
    type: "info",
    read: false,
    actionUrl: "/employee/goals/g-rahul-sales-revenue",
    createdAt: "2025-04-14T11:35:00.000Z",
  },
  {
    id: "notif-e-003",
    userId: "u-rahul-verma",
    targetRole: "employee",
    title: "Goal Sheet Approved",
    message:
      "Your FY2025 goal sheet has been approved by Vikram Nair. Your goals are now set and the cycle begins.",
    type: "success",
    read: true,
    actionUrl: "/employee/goals",
    createdAt: "2025-04-18T14:35:00.000Z",
  },
  {
    id: "notif-e-004",
    userId: "u-rahul-verma",
    targetRole: "employee",
    title: "FY2026 Goal-Setting Window Open",
    message:
      "The goal-setting window for FY2026 is now open (1–31 May 2026). Start drafting your goals for the new financial year.",
    type: "action",
    read: true,
    actionUrl: "/employee/goals",
    createdAt: "2026-05-01T07:00:00.000Z",
  },
];

// Manager notifications (for Vikram)
export const MANAGER_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-m-001",
    userId: "u-vikram-nair",
    targetRole: "manager",
    title: "Goal Sheet Pending Review",
    message:
      "Sneha Patel has submitted her FY2026 goal sheet. Review and approve before the window closes on 31 May 2026.",
    type: "action",
    read: false,
    actionUrl: "/manager/review",
    createdAt: "2026-05-10T12:05:00.000Z",
  },
  {
    id: "notif-m-002",
    userId: "u-vikram-nair",
    targetRole: "manager",
    title: "Rahul Verma Has Draft Goals",
    message:
      "Rahul Verma has 1 draft goal in the FY2026 cycle but has not submitted the goal sheet yet. Remind them to submit.",
    type: "warning",
    read: false,
    actionUrl: "/manager/team-goals/u-rahul-verma",
    createdAt: "2026-05-14T09:00:00.000Z",
  },
  {
    id: "notif-m-003",
    userId: "u-vikram-nair",
    targetRole: "manager",
    title: "FY2025 Cycle Locked",
    message:
      "The FY2025 goal-setting cycle has been locked by admin. All approved goals are now read-only.",
    type: "info",
    read: true,
    createdAt: "2026-04-01T06:05:00.000Z",
  },
  {
    id: "notif-m-004",
    userId: "u-vikram-nair",
    targetRole: "manager",
    title: "Q1 Report Available",
    message:
      "The Q1 FY2026 performance report is ready for your team. Review individual goal progress.",
    type: "info",
    read: true,
    actionUrl: "/manager/reports",
    createdAt: "2026-07-05T08:00:00.000Z",
  },
];

// Admin notifications (for Priya)
export const ADMIN_NOTIFICATIONS: Notification[] = [
  {
    id: "notif-a-001",
    userId: "u-priya-sharma",
    targetRole: "admin",
    title: "5 Goal Sheets Pending Approval",
    message:
      "5 employees in the Sales department have submitted goal sheets awaiting manager approval. Window closes 31 May 2026.",
    type: "warning",
    read: false,
    actionUrl: "/admin/users",
    createdAt: "2026-05-14T08:30:00.000Z",
  },
  {
    id: "notif-a-002",
    userId: "u-priya-sharma",
    targetRole: "admin",
    title: "FY2026 Goal-Setting Window Active",
    message:
      "The FY2026 goal-setting window opened on 1 May 2026. Monitor submission progress from the admin dashboard.",
    type: "info",
    read: true,
    actionUrl: "/admin/cycles/cycle-fy2026",
    createdAt: "2026-05-01T07:00:00.000Z",
  },
  {
    id: "notif-a-003",
    userId: "u-priya-sharma",
    targetRole: "admin",
    title: "Audit Log: Cycle Config Updated",
    message:
      "FY2026 cycle configuration was created by Priya Sharma on 28 April 2026.",
    type: "info",
    read: true,
    actionUrl: "/admin/audit",
    createdAt: "2026-04-28T09:05:00.000Z",
  },
  {
    id: "notif-a-004",
    userId: "u-priya-sharma",
    targetRole: "admin",
    title: "New Employee Onboarded",
    message:
      "Arjun Mehta (ATB005) has been added to the Operations department. Assign a manager and ensure goal-setting for FY2026.",
    type: "action",
    read: false,
    actionUrl: "/admin/users/u-arjun-mehta",
    createdAt: "2026-05-12T10:00:00.000Z",
  },
];

export const mockNotifications: Notification[] = [
  ...EMPLOYEE_NOTIFICATIONS,
  ...MANAGER_NOTIFICATIONS,
  ...ADMIN_NOTIFICATIONS,
];

/** Get notifications for a specific user */
export function getNotificationsForUser(userId: string): Notification[] {
  return mockNotifications.filter((n) => n.userId === userId);
}
