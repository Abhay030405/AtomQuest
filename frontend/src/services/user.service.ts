import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";
import type { User, UserRole } from "@/types/user.types";

interface ApiUserListItem {
  id: string;
  email: string;
  full_name: string;
  role: string;
  employee_code?: string | null;
  phone_number?: string | null;
  department_id?: string | null;
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

export interface Department {
  id: string;
  name: string;
}

interface ApiDepartment {
  id: string;
  name: string;
}

export interface CreateUserInput {
  email: string;
  fullName: string;
  password: string;
  role: UserRole;
  departmentId: string;
  managerId?: string;
  phoneNumber?: string;
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
    departmentId: u.department_id ?? "",
    departmentName: u.department_name ?? "",
    employeeCode: u.employee_code ?? "",
    phoneNumber: u.phone_number ?? undefined,
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
    phoneNumber: u.phone_number ?? undefined,
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

  getDepartments: async (): Promise<Department[]> => {
    const resp = await apiClient.get<APIResponse<ApiDepartment[]>>("/v1/departments/");
    const data = unwrap(resp, "Failed to load departments");
    return data.map((d) => ({ id: d.id, name: d.name }));
  },

  createUser: async (input: CreateUserInput): Promise<User> => {
    const body: Record<string, unknown> = {
      email: input.email,
      full_name: input.fullName,
      password: input.password,
      role: input.role,
      department_id: input.departmentId,
      phone_number: input.phoneNumber ?? null,
    };
    if (input.managerId) body.manager_id = input.managerId;
    const resp = await apiClient.post<APIResponse<ApiUserResponse>>("/v1/users/", body);
    return mapFullUser(unwrap(resp, "Failed to create user"));
  },
};

