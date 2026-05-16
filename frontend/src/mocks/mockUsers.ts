import { UserRole } from "@/types/user.types";
import type { User } from "@/types/user.types";
import { ROLE_PERMISSIONS } from "@/constants/permissions";

// ─── Users ────────────────────────────────────────────────────────────────────

export const PRIYA_SHARMA: User = {
  id: "u-priya-sharma",
  email: "priya.sharma@atomberg.com",
  fullName: "Priya Sharma",
  role: UserRole.ADMIN,
  departmentId: "dept-hr",
  departmentName: "Human Resources",
  employeeCode: "ATB001",
  isActive: true,
  permissions: ROLE_PERMISSIONS[UserRole.ADMIN],
  avatarInitials: "PS",
};

export const VIKRAM_NAIR: User = {
  id: "u-vikram-nair",
  email: "vikram.nair@atomberg.com",
  fullName: "Vikram Nair",
  role: UserRole.MANAGER,
  managerId: "u-priya-sharma",
  managerName: "Priya Sharma",
  departmentId: "dept-sales",
  departmentName: "Sales",
  employeeCode: "ATB002",
  isActive: true,
  permissions: ROLE_PERMISSIONS[UserRole.MANAGER],
  avatarInitials: "VN",
};

export const RAHUL_VERMA: User = {
  id: "u-rahul-verma",
  email: "rahul.verma@atomberg.com",
  fullName: "Rahul Verma",
  role: UserRole.EMPLOYEE,
  managerId: "u-vikram-nair",
  managerName: "Vikram Nair",
  departmentId: "dept-sales",
  departmentName: "Sales",
  employeeCode: "ATB003",
  isActive: true,
  permissions: ROLE_PERMISSIONS[UserRole.EMPLOYEE],
  avatarInitials: "RV",
};

export const SNEHA_PATEL: User = {
  id: "u-sneha-patel",
  email: "sneha.patel@atomberg.com",
  fullName: "Sneha Patel",
  role: UserRole.EMPLOYEE,
  managerId: "u-vikram-nair",
  managerName: "Vikram Nair",
  departmentId: "dept-sales",
  departmentName: "Sales",
  employeeCode: "ATB004",
  isActive: true,
  permissions: ROLE_PERMISSIONS[UserRole.EMPLOYEE],
  avatarInitials: "SP",
};

export const ARJUN_MEHTA: User = {
  id: "u-arjun-mehta",
  email: "arjun.mehta@atomberg.com",
  fullName: "Arjun Mehta",
  role: UserRole.EMPLOYEE,
  departmentId: "dept-ops",
  departmentName: "Operations",
  employeeCode: "ATB005",
  isActive: true,
  permissions: ROLE_PERMISSIONS[UserRole.EMPLOYEE],
  avatarInitials: "AM",
};

export const mockUsers: User[] = [
  PRIYA_SHARMA,
  VIKRAM_NAIR,
  RAHUL_VERMA,
  SNEHA_PATEL,
  ARJUN_MEHTA,
];

/** Quick lookup map: userId → User */
export const USERS_BY_ID: Record<string, User> = Object.fromEntries(
  mockUsers.map((u) => [u.id, u])
);

/** Helper: get user by employee code */
export function getUserByCode(code: string): User | undefined {
  return mockUsers.find((u) => u.employeeCode === code);
}
