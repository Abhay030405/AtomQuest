import { useAuthStore } from "@/store/authStore";
import { UserRole } from "@/types/user.types";

export function useAuth() {
  const currentUser = useAuthStore((s) => s.currentUser);
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const isLoading = useAuthStore((s) => s.isLoading);
  const loginError = useAuthStore((s) => s.loginError);
  const login = useAuthStore((s) => s.login);
  const logout = useAuthStore((s) => s.logout);
  const hasPermission = useAuthStore((s) => s.hasPermission);
  const switchRole = useAuthStore((s) => s.switchRole);

  const isEmployee = currentUser?.role === UserRole.EMPLOYEE;
  const isManager = currentUser?.role === UserRole.MANAGER;
  const isAdmin = currentUser?.role === UserRole.ADMIN;

  return {
    currentUser,
    token,
    isAuthenticated,
    isLoading,
    loginError,
    login,
    logout,
    hasPermission,
    switchRole,
    isEmployee,
    isManager,
    isAdmin,
  };
}
