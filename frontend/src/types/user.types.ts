export const UserRole = {
  EMPLOYEE: "employee",
  MANAGER: "manager",
  ADMIN: "admin",
} as const;
export type UserRole = (typeof UserRole)[keyof typeof UserRole];

export const Permission = {
  CREATE_GOAL: "CREATE_GOAL",
  SUBMIT_GOAL_SHEET: "SUBMIT_GOAL_SHEET",
  EDIT_OWN_DRAFT_GOAL: "EDIT_OWN_DRAFT_GOAL",
  VIEW_OWN_GOALS: "VIEW_OWN_GOALS",
  VIEW_TEAM_GOALS: "VIEW_TEAM_GOALS",
  APPROVE_GOAL: "APPROVE_GOAL",
  REJECT_GOAL: "REJECT_GOAL",
  EDIT_GOAL_IN_REVIEW: "EDIT_GOAL_IN_REVIEW",
  RETURN_FOR_REWORK: "RETURN_FOR_REWORK",
  PUSH_SHARED_GOAL: "PUSH_SHARED_GOAL",
  UNLOCK_GOAL: "UNLOCK_GOAL",
  CONFIGURE_CYCLE: "CONFIGURE_CYCLE",
  VIEW_ALL_GOALS: "VIEW_ALL_GOALS",
  EXPORT_REPORTS: "EXPORT_REPORTS",
  VIEW_AUDIT_LOG: "VIEW_AUDIT_LOG",
} as const;
export type Permission = (typeof Permission)[keyof typeof Permission];

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  fullName: string;
  role: UserRole;
  managerId?: string;
  managerName?: string;
  departmentId: string;
  departmentName: string;
  employeeCode: string;
  isActive: boolean;
  permissions: Permission[];
  avatarInitials: string;
}

export interface OrgNode {
  id: string;
  fullName: string;
  role: UserRole;
  departmentName: string;
  employeeCode: string;
  children: OrgNode[];
}
