import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";
import type { User, UserRole } from "@/types/user.types";

interface ApiUserListItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  employee_code?: string | null;
  department_name?: string | null;
  manager_name?: string | null;
  is_active: boolean;
}

interface ApiUserResponse extends ApiUserListItem {
  department_id?: string | null;
  manager_id?: string | null;
  permissions?: string[];
  created_at?: string;
}

function initials(name: string): string {
  return (name ?? "??")
    .split(/\s+/)
    .filter(Boolean)
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function mapListUser(u: ApiUserListItem): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role as UserRole,
    departmentId: "",
    departmentName: u.department_name ?? "",
    employeeCode: u.employee_code ?? "",
    managerName: u.manager_name ?? undefined,
    isActive: u.is_active,
    permissions: [],
    avatarInitials: initials(u.full_name),
  };
}

function mapFullUser(u: ApiUserResponse): User {
  return {
    id: u.id,
    email: u.email,
    fullName: u.full_name,
    role: u.role as UserRole,
    departmentId: u.department_id ?? "",
    departmentName: u.department_name ?? "",
    employeeCode: u.employee_code ?? "",
    managerId: u.manager_id ?? undefined,
    managerName: u.manager_name ?? undefined,
    isActive: u.is_active,
    permissions: (u.permissions ?? []) as User["permissions"],
    avatarInitials: initials(u.full_name),
  };
}

function unwrap<T>(resp: APIResponse<T>, fallback: string): T {
  if (!resp.success || resp.data === null || resp.data === undefined) {
    throw new Error(resp.error?.message ?? fallback);
  }
  return resp.data;
}

export const userService = {
  // managerId is kept for React Query key compatibility — backend derives the
  // authenticated user from the bearer token.
  getDirectReports: async (_managerId: string): Promise<User[]> => {
    const resp = await apiClient.get<APIResponse<ApiUserListItem[]>>("/v1/users/me/team");
    const data = unwrap(resp, "Failed to load direct reports");
    return data.map(mapListUser);
  },

  // Admin-only — lists every user org-wide with manager + department names.
  getAllUsers: async (): Promise<User[]> => {
    const resp = await apiClient.get<APIResponse<{ items: ApiUserListItem[] }>>(
      "/v1/users/?page_size=200"
    );
    const data = unwrap(resp, "Failed to load users");
    return data.items.map(mapListUser);
  },

  getUserById: async (userId: string): Promise<User | null> => {
    const resp = await apiClient.get<APIResponse<ApiUserResponse>>(`/v1/users/${userId}`);
    if (!resp.success) return null;
    return resp.data ? mapFullUser(resp.data) : null;
  },
};
