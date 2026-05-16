export const ROUTES = {
  LOGIN: "/login",

  EMPLOYEE: {
    ROOT: "/employee",
    GOALS: "/employee/goals",
    GOAL_DETAIL: (id: string) => `/employee/goals/${id}`,
    QUARTERLY_UPDATE: "/employee/quarterly-update",
    PROFILE: "/employee/profile",
  },

  MANAGER: {
    ROOT: "/manager",
    REVIEW: "/manager/review",
    REVIEW_SHEET: (sheetId: string) => `/manager/review/${sheetId}`,
    TEAM_GOALS: "/manager/team-goals",
    TEAM_GOAL_DETAIL: (userId: string) => `/manager/team-goals/${userId}`,
    REVIEW_GOAL: (goalId: string) => `/manager/review/${goalId}`,
    CHECKIN: "/manager/checkin",
    REPORTS: "/manager/reports",
  },

  ADMIN: {
    ROOT: "/admin",
    USERS: "/admin/users",
    USER_DETAIL: (id: string) => `/admin/users/${id}`,
    CYCLES: "/admin/cycles",
    CYCLE_DETAIL: (id: string) => `/admin/cycles/${id}`,
    SHARED_GOALS: "/admin/shared-goals",
    GOAL_UNLOCK: "/admin/goal-unlock",
    AUDIT: "/admin/audit",
    REPORTS: "/admin/reports",
    SETTINGS: "/admin/settings",
  },
} as const;

// ─── Path → human-readable title ─────────────────────────────────────────────

export const PAGE_TITLES: Record<string, string> = {
  "/employee": "Dashboard",
  "/employee/goals": "My Goals",
  "/employee/quarterly-update": "Quarterly Update",
  "/manager": "Dashboard",
  "/manager/review": "Approval Queue",
  "/manager/team-goals": "Team Goals",
  "/manager/checkin": "Check-in Module",
  "/manager/reports": "Reports",
  "/admin": "Dashboard",
  "/admin/cycles": "Cycle Configuration",
  "/admin/shared-goals": "Shared Goals",
  "/admin/goal-unlock": "Goal Unlock",
  "/admin/audit": "Audit Trail",
  "/admin/reports": "Reports",
  "/admin/users": "User Management",
};
