import { UserRole, Permission } from "@/types/user.types";

// ─── RBAC matrix ─────────────────────────────────────────────────────────────
// Maps each role to its allowed permissions.

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.EMPLOYEE]: [
    Permission.CREATE_GOAL,
    Permission.SUBMIT_GOAL_SHEET,
    Permission.EDIT_OWN_DRAFT_GOAL,
    Permission.VIEW_OWN_GOALS,
  ],

  [UserRole.MANAGER]: [
    Permission.CREATE_GOAL,
    Permission.VIEW_OWN_GOALS,
    Permission.VIEW_TEAM_GOALS,
    Permission.APPROVE_GOAL,
    Permission.REJECT_GOAL,
    Permission.EDIT_GOAL_IN_REVIEW,
    Permission.RETURN_FOR_REWORK,
    Permission.PUSH_SHARED_GOAL,
    Permission.EXPORT_REPORTS,
  ],

  [UserRole.ADMIN]: [
    Permission.CREATE_GOAL,
    Permission.VIEW_OWN_GOALS,
    Permission.VIEW_TEAM_GOALS,
    Permission.VIEW_ALL_GOALS,
    Permission.APPROVE_GOAL,
    Permission.REJECT_GOAL,
    Permission.EDIT_GOAL_IN_REVIEW,
    Permission.RETURN_FOR_REWORK,
    Permission.PUSH_SHARED_GOAL,
    Permission.UNLOCK_GOAL,
    Permission.CONFIGURE_CYCLE,
    Permission.EXPORT_REPORTS,
    Permission.VIEW_AUDIT_LOG,
  ],
};

/** Returns true if the given permissions array includes the required action. */
export function can(
  permissions: Permission[],
  action: Permission
): boolean {
  return permissions.includes(action);
}
