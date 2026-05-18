import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { User, UserRole } from "@/types/user.types";
import { Permission } from "@/types/user.types";
import type { APIResponse } from "@/types/api.types";
import { apiClient } from "@/services/api-client";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleFromApi(role: string): UserRole {
  const normalized = role.toLowerCase();
  if (normalized === "employee" || normalized === "manager" || normalized === "admin") {
    return normalized as UserRole;
  }
  throw new Error("Invalid role returned from server.");
}

function deriveDisplayName(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ")
    .trim() || email;
}

function deriveInitials(displayName: string): string {
  const parts = displayName.split(" ").filter(Boolean);
  if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
  return displayName.slice(0, 2).toUpperCase();
}

type LoginApiUser = {
  id?: string;
  email: string;
  role: string;
  permissions: Permission[];
  full_name?: string;
  department_id?: string;
  department_name?: string;
  employee_code?: string;
  is_active?: boolean;
};

type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
  user: LoginApiUser;
};

function mapLoginUser(apiUser: LoginApiUser): User {
  const fullName = apiUser.full_name ?? deriveDisplayName(apiUser.email);
  const normalizedPermissions = apiUser.permissions.map((perm) =>
    perm.toString().trim().toUpperCase() as Permission
  );
  return {
    id: apiUser.id ?? apiUser.email,
    email: apiUser.email,
    fullName,
    role: roleFromApi(apiUser.role),
    managerId: undefined,
    managerName: undefined,
    departmentId: apiUser.department_id ?? "",
    departmentName: apiUser.department_name ?? "",
    employeeCode: apiUser.employee_code ?? "",
    isActive: apiUser.is_active ?? true,
    permissions: normalizedPermissions,
    avatarInitials: deriveInitials(fullName),
  };
}

// ─── State ────────────────────────────────────────────────────────────────────

interface AuthState {
  currentUser: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  loginError: string | null;

  login: (email: string, password: string, expectedRole?: UserRole) => Promise<User>;
  loginWithMicrosoftTokens: (accessToken: string, refreshToken: string, apiUser: LoginApiUser) => User;
  logout: () => void;
  hasPermission: (permission: Permission) => boolean;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      loginError: null,

      login: async (email, password, expectedRole) => {
        set({ isLoading: true, loginError: null });
        try {
          const response = await apiClient.post<APIResponse<LoginResponse>>(
            "/v1/auth/login",
            { email, password }
          );
          if (!response.success) {
            throw new Error(response.error?.message ?? "Invalid credentials. Please try again.");
          }
          const mappedUser = mapLoginUser(response.data.user);
          if (expectedRole && mappedUser.role !== expectedRole) {
            throw new Error("Invalid credentials. Please try again.");
          }
          set({
            currentUser: mappedUser,
            token: response.data.access_token,
            refreshToken: response.data.refresh_token,
            isAuthenticated: true,
            isLoading: false,
          });
          return mappedUser;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Invalid credentials. Please try again.";
          set({ isLoading: false, loginError: message });
          throw new Error(message);
        }
      },

      loginWithMicrosoftTokens: (accessToken, refreshToken, apiUser) => {
        const mappedUser = mapLoginUser(apiUser);
        set({
          currentUser: mappedUser,
          token: accessToken,
          refreshToken,
          isAuthenticated: true,
          isLoading: false,
          loginError: null,
        });
        return mappedUser;
      },

      logout: () =>
        set({
          currentUser: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          loginError: null,
        }),

      hasPermission: (permission) => {
        const { currentUser } = get();
        return currentUser?.permissions.includes(permission) ?? false;
      },
    }),
    {
      name: "atomquest-auth",
      // Only persist auth state, not loading / error
      partialize: (state) => ({
        currentUser: state.currentUser,
        token: state.token,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
