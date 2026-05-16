import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import { useAuthStore } from "@/store/authStore";
import type { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";

export function usePermission(permission: Permission): boolean {
  return useAuthStore((s) => s.hasPermission(permission));
}

export function useRequirePermission(permission: Permission): boolean {
  const navigate = useNavigate();
  const allowed = usePermission(permission);

  useEffect(() => {
    if (!allowed) {
      navigate(ROUTES.LOGIN, { replace: true });
    }
  }, [allowed, navigate]);

  return allowed;
}
