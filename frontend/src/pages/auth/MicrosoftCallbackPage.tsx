import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";
import type { APIResponse } from "@/types/api.types";

const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  permissions: Permission[];
  full_name?: string;
  department_id?: string;
  department_name?: string;
  employee_code?: string;
  is_active?: boolean;
};

const ERROR_MESSAGES: Record<string, string> = {
  user_not_found: "Your Microsoft account is not registered in AtomQuest. Contact your HR Admin.",
  account_deactivated: "Your account has been deactivated. Contact HR Admin.",
  token_exchange_failed: "Microsoft sign-in failed. Please try again.",
  token_missing: "Microsoft sign-in failed. Please try again.",
  graph_api_failed: "Could not retrieve your Microsoft profile. Please try again.",
  email_not_found: "Could not read your email from Microsoft. Please try again.",
  access_denied: "Sign-in was cancelled or access was denied.",
};

function getDashboard(permissions: Permission[], userId: string): string {
  if (permissions.includes(Permission.CONFIGURE_CYCLE)) return ROUTES.ADMIN.ROOT(userId);
  if (permissions.includes(Permission.APPROVE_GOAL)) return ROUTES.MANAGER.ROOT(userId);
  return ROUTES.EMPLOYEE.ROOT(userId);
}

export default function MicrosoftCallbackPage() {
  const navigate = useNavigate();
  const { loginWithMicrosoftTokens } = useAuthStore();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;

    const params = new URLSearchParams(window.location.search);
    const error = params.get("error");
    const accessToken = params.get("access_token");
    const refreshToken = params.get("refresh_token");

    if (error) {
      const msg = ERROR_MESSAGES[error] ?? `Sign-in failed: ${error}`;
      toast.error(msg);
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    if (!accessToken || !refreshToken) {
      toast.error("Sign-in failed: missing tokens.");
      navigate(ROUTES.LOGIN, { replace: true });
      return;
    }

    // Fetch the current user profile using the access token we just received
    (async () => {
      try {
        const res = await fetch(`${BASE_URL}/v1/auth/me`, {
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const body = (await res.json()) as APIResponse<MeResponse>;

        if (!res.ok || !body.success) {
          throw new Error(
            (body as { error?: { message?: string } }).error?.message ?? "Could not load profile."
          );
        }

        const user = loginWithMicrosoftTokens(accessToken, refreshToken, body.data);
        toast.success(`Signed in as ${user.fullName}`);
        navigate(getDashboard(user.permissions, user.id), { replace: true });
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
        navigate(ROUTES.LOGIN, { replace: true });
      }
    })();
  }, [loginWithMicrosoftTokens, navigate]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-background">
      <div className="flex flex-col items-center gap-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-medium">Signing you in with Microsoft…</p>
      </div>
    </div>
  );
}
