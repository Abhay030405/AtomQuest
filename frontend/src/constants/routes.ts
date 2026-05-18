export const ROUTES = {
  LOGIN: "/login",

  EMPLOYEE: {
    ROOT: (userId: string) => `/employee/${userId}`,
    GOALS: (userId: string) => `/employee/${userId}/goals`,
    GOAL_DETAIL: (userId: string, id: string) => `/employee/${userId}/goals/${id}`,
    QUARTERLY_UPDATE: (userId: string) => `/employee/${userId}/quarterly-update`,
    PROFILE: (userId: string) => `/employee/${userId}/profile`,
  },

  MANAGER: {
    ROOT: (userId: string) => `/manager/${userId}`,
    REVIEW: (userId: string) => `/manager/${userId}/review`,
    REVIEW_SHEET: (userId: string, sheetId: string) => `/manager/${userId}/review/${sheetId}`,
    TEAM_GOALS: (userId: string) => `/manager/${userId}/team-goals`,
    TEAM_GOAL_DETAIL: (userId: string, teamUserId: string) => `/manager/${userId}/team-goals/${teamUserId}`,
    REVIEW_GOAL: (userId: string, goalId: string) => `/manager/${userId}/review/${goalId}`,
    CHECKIN: (userId: string) => `/manager/${userId}/checkin`,
    REPORTS: (userId: string) => `/manager/${userId}/reports`,
  },

  ADMIN: {
    ROOT: (userId: string) => `/admin/${userId}`,
    PERSONNEL: (userId: string) => `/admin/${userId}/personnel`,
    PERSONNEL_NEW_EMPLOYEE: (userId: string) => `/admin/${userId}/personnel/new-employee`,
    PERSONNEL_NEW_MANAGER: (userId: string) => `/admin/${userId}/personnel/new-manager`,
    USERS: (userId: string) => `/admin/${userId}/users`,
    USER_DETAIL: (userId: string, id: string) => `/admin/${userId}/users/${id}`,
    CYCLES: (userId: string) => `/admin/${userId}/cycles`,
    CYCLE_DETAIL: (userId: string, id: string) => `/admin/${userId}/cycles/${id}`,
    SHARED_GOALS: (userId: string) => `/admin/${userId}/shared-goals`,
    GOAL_UNLOCK: (userId: string) => `/admin/${userId}/goal-unlock`,
    AUDIT: (userId: string) => `/admin/${userId}/audit`,
    REPORTS: (userId: string) => `/admin/${userId}/reports`,
    SETTINGS: (userId: string) => `/admin/${userId}/settings`,
  },
} as const;

export const ROUTE_PATTERNS = {
  EMPLOYEE: {
    ROOT: "/employee/:userId",
    GOALS: "/employee/:userId/goals",
    GOAL_DETAIL: "/employee/:userId/goals/:goalId",
    QUARTERLY_UPDATE: "/employee/:userId/quarterly-update",
    PROFILE: "/employee/:userId/profile",
  },
  MANAGER: {
    ROOT: "/manager/:userId",
    REVIEW: "/manager/:userId/review",
    REVIEW_SHEET: "/manager/:userId/review/:sheetId",
    TEAM_GOALS: "/manager/:userId/team-goals",
    TEAM_GOAL_DETAIL: "/manager/:userId/team-goals/:teamUserId",
    CHECKIN: "/manager/:userId/checkin",
    REPORTS: "/manager/:userId/reports",
  },
  ADMIN: {
    ROOT: "/admin/:userId",
    PERSONNEL: "/admin/:userId/personnel",
    PERSONNEL_NEW_EMPLOYEE: "/admin/:userId/personnel/new-employee",
    PERSONNEL_NEW_MANAGER: "/admin/:userId/personnel/new-manager",
    USERS: "/admin/:userId/users",
    USER_DETAIL: "/admin/:userId/users/:targetUserId",
    CYCLES: "/admin/:userId/cycles",
    CYCLE_DETAIL: "/admin/:userId/cycles/:cycleId",
    SHARED_GOALS: "/admin/:userId/shared-goals",
    GOAL_UNLOCK: "/admin/:userId/goal-unlock",
    AUDIT: "/admin/:userId/audit",
    REPORTS: "/admin/:userId/reports",
    SETTINGS: "/admin/:userId/settings",
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
  "/admin/personnel": "View Personnel",
  "/admin/cycles": "Cycle Configuration",
  "/admin/shared-goals": "Shared Goals",
  "/admin/goal-unlock": "Goal Unlock",
  "/admin/audit": "Audit Trail",
  "/admin/reports": "Reports",
  "/admin/users": "User Management",
};
