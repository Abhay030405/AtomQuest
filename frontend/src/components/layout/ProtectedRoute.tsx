import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Lock } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import type { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";
import { Button } from "@/components/ui/button";

interface Props {
  /** If provided, user must hold at least one of these permissions */
  requiredPermission?: Permission;
}

// ─── 403 page (inline, no redirect) ──────────────────────────────────────────

function AccessDeniedPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-4">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100">
        <Lock className="h-8 w-8 text-red-500" />
      </div>
      <div className="space-y-2 text-center">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">
          Access Denied
        </h1>
        <p className="max-w-md text-muted-foreground">
          You don't have permission to view this page. Contact your administrator
          if you believe this is a mistake.
        </p>
      </div>
      <Button
        variant="outline"
        onClick={() => {
          globalThis.history.back();
        }}
      >
        Go Back
      </Button>
    </div>
  );
}

// ─── Protected route wrapper ──────────────────────────────────────────────────

export function ProtectedRoute({ requiredPermission }: Readonly<Props>) {
  const location = useLocation();
  const { isAuthenticated, hasPermission } = useAuthStore();

  // Not authenticated → redirect to login, preserving attempted URL
  if (!isAuthenticated) {
    return (
      <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />
    );
  }

  // Has required permission check
  if (requiredPermission && !hasPermission(requiredPermission)) {
    return <AccessDeniedPage />;
  }

  return <Outlet />;
}
