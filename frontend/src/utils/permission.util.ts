import { Permission, UserRole } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";

export function canPerformAction(
  permissions: Permission[],
  action: Permission
): boolean {
  return permissions.includes(action);
}

export function getAccessibleRoutes(role: UserRole): string[] {
  switch (role) {
    case UserRole.EMPLOYEE:
      return [ROUTES.EMPLOYEE.ROOT, ROUTES.EMPLOYEE.GOALS];
    case UserRole.MANAGER:
      return [ROUTES.MANAGER.ROOT, ROUTES.MANAGER.TEAM_GOALS, ROUTES.MANAGER.REVIEW];
    case UserRole.ADMIN:
      return [ROUTES.ADMIN.ROOT, ROUTES.ADMIN.USERS, ROUTES.ADMIN.CYCLES];
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
