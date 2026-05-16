import { Permission, UserRole } from "@/types/user.types";
import { ROUTE_PATTERNS } from "@/constants/routes";

export function canPerformAction(
  permissions: Permission[],
  action: Permission
): boolean {
  return permissions.includes(action);
}

export function getAccessibleRoutes(role: UserRole): string[] {
  switch (role) {
    case UserRole.EMPLOYEE:
      return [ROUTE_PATTERNS.EMPLOYEE.ROOT, ROUTE_PATTERNS.EMPLOYEE.GOALS];
    case UserRole.MANAGER:
      return [
        ROUTE_PATTERNS.MANAGER.ROOT,
        ROUTE_PATTERNS.MANAGER.TEAM_GOALS,
        ROUTE_PATTERNS.MANAGER.REVIEW,
      ];
    case UserRole.ADMIN:
      return [
        ROUTE_PATTERNS.ADMIN.ROOT,
        ROUTE_PATTERNS.ADMIN.USERS,
        ROUTE_PATTERNS.ADMIN.CYCLES,
      ];
    default:
      return [];
  }
}

export function getRoleDisplayName(role: UserRole): string {
  switch (role) {
    case UserRole.EMPLOYEE:
      return "Employee";
    case UserRole.MANAGER:
      return "Manager";
    case UserRole.ADMIN:
      return "HR Admin";
  }
}

export function getRoleColor(role: UserRole): string {
  switch (role) {
    case UserRole.EMPLOYEE:
      return "bg-blue-100 text-blue-800";
    case UserRole.MANAGER:
      return "bg-amber-100 text-amber-800";
    case UserRole.ADMIN:
      return "bg-purple-100 text-purple-800";
  }
}
