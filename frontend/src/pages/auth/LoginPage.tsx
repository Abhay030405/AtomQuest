import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Sun,
  Moon,
  ChevronRight,
  Lock,
  Loader2,
  Eye,
  EyeOff,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";

// ─── Theme hook ────────────────────────────────────────────────────────────────

function useTheme() {
  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    try {
      return localStorage.getItem("atomquest-theme") === "dark" ? "dark" : "light";
    } catch {
      return "light";
    }
  });

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("atomquest-theme", theme);
  }, [theme]);

  return { theme, setTheme: setThemeState };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDashboard(permissions: string[], userId: string): string {
  if (permissions.includes(Permission.CONFIGURE_CYCLE)) return ROUTES.ADMIN.ROOT(userId);
  if (permissions.includes(Permission.APPROVE_GOAL)) return ROUTES.MANAGER.ROOT(userId);
  return ROUTES.EMPLOYEE.ROOT(userId);
}

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLES = [
  {
    key: "employee",
    title: "Employee",
    desc: "Access your goals and track progress",
    accent: "#2f6ee8",
    gradient: "linear-gradient(135deg,#4f8df9 0%,#2f6ee8 100%)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <circle cx="9" cy="11" r="2.2" />
        <path d="M5.5 16.5c.7-1.6 2.1-2.5 3.5-2.5s2.8.9 3.5 2.5" />
        <path d="M14.5 9.5h4M14.5 12.5h3" />
      </svg>
    ),
  },
  {
    key: "manager",
    title: "Manager",
    desc: "Review team goals and performance",
    accent: "#5b3ce0",
    gradient: "linear-gradient(135deg,#7b5cf7 0%,#5b3ce0 100%)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <circle cx="9" cy="9" r="3" />
        <path d="M3.5 19c.8-2.6 3-4 5.5-4s4.7 1.4 5.5 4" />
        <circle cx="17" cy="8" r="2.4" />
        <path d="M15.5 14.2c2.2.2 4 1.6 4.5 3.8" />
      </svg>
    ),
  },
  {
    key: "admin",
    title: "Admin",
    desc: "Manage users and system settings",
    accent: "#0d9488",
    gradient: "linear-gradient(135deg,#2dd4bf 0%,#14b8a6 100%)",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" className="h-[22px] w-[22px]">
        <path d="M12 3l8 3v6c0 4.5-3.4 8.4-8 9-4.6-.6-8-4.5-8-9V6l8-3z" />
        <path d="M9.5 12.5l2 2 3.5-4" />
      </svg>
    ),
  },
] as const;

type RoleConfig = (typeof ROLES)[number];

// ─── Premium display font (headings only) ──────────────────────────────────────

const DISPLAY_FONT = "'Plus Jakarta Sans', 'Geist', system-ui, sans-serif";

// ─── CSS vars shorthand per theme ──────────────────────────────────────────────

function tv(theme: "light" | "dark", light: string, dark: string) {
  return theme === "dark" ? dark : light;
}

const T = {
  bg:          (t: "light" | "dark") => tv(t, "#f3f4f7", "#0b1220"),
  panel:       (t: "light" | "dark") => tv(t, "#ffffff", "#111a2e"),
  // Stronger borders so the boxes read crisp instead of washed-out.
  border:      (t: "light" | "dark") => tv(t, "#d6dae3", "#2a3656"),
  borderStrong:(t: "light" | "dark") => tv(t, "#bcc2d1", "#3a4868"),
  text:        (t: "light" | "dark") => tv(t, "#0b1220", "#f1f5fb"),
  muted:       (t: "light" | "dark") => tv(t, "#5b6477", "#9aa3b7"),
  inputBg:     (t: "light" | "dark") => tv(t, "#f3f4f7", "#0b1220"),
};

// ─── Shared input style ────────────────────────────────────────────────────────

function inputStyle(theme: "light" | "dark"): React.CSSProperties {
  return {
    background: T.inputBg(theme),
    border: `1px solid ${T.border(theme)}`,
    color: T.text(theme),
  };
}

// ─── Microsoft 4-colour logo ───────────────────────────────────────────────────

function MsLogo() {
  return (
    <span className="inline-grid h-[22px] w-[22px] grid-cols-2 gap-[2.5px]" aria-hidden="true">
      <span className="block bg-[#f25022]" />
      <span className="block bg-[#7fba00]" />
      <span className="block bg-[#00a4ef]" />
      <span className="block bg-[#ffb900]" />
    </span>
  );
}

// ─── Roles selection view ──────────────────────────────────────────────────────

interface RolesViewProps {
  theme: "light" | "dark";
  onRoleClick: (role: RoleConfig) => void;
}

function RolesView({ theme, onRoleClick }: RolesViewProps) {
  const [msLoading, setMsLoading] = useState(false);

  const handleMicrosoft = () => {
    setMsLoading(true);
    setTimeout(() => {
      setMsLoading(false);
      toast.info("Microsoft SSO is not configured in this demo.");
    }, 1400);
  };

  return (
    <>
      {/* Hero */}
      <div className="mb-10 text-center">
        <h1
          className="mb-3 font-extrabold"
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 44,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
            color: T.text(theme),
          }}
        >
          Welcome back
        </h1>
        <p className="text-[17px]" style={{ color: T.muted(theme) }}>
          Sign in to continue to AtomQuest Portal
        </p>
      </div>

      {/* Microsoft SSO button */}
      <button
        type="button"
        onClick={handleMicrosoft}
        disabled={msLoading}
        className={cn(
          "flex w-full items-center justify-center gap-3.5 rounded-xl px-5 py-[19px]",
          "text-[16px] font-semibold transition-all duration-150 hover:-translate-y-px",
          "disabled:pointer-events-none disabled:opacity-75"
        )}
        style={{
          background: T.panel(theme),
          border: `1px solid ${T.borderStrong(theme)}`,
          color: T.text(theme),
          boxShadow: "0 1px 2px rgba(16,24,40,0.05)",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.borderColor = "#7e14ff";
          e.currentTarget.style.boxShadow = "0 0 0 3px rgba(126,20,255,0.12), 0 8px 20px -8px rgba(16,24,40,0.18)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.borderColor = T.borderStrong(theme);
          e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,0.05)";
        }}
      >
        {msLoading ? (
          <span
            className="h-[18px] w-[18px] animate-spin rounded-full border-[2.5px]"
            style={{ borderColor: T.borderStrong(theme), borderTopColor: "#3b82f6" }}
          />
        ) : (
          <>
            <MsLogo />
            <span>Sign in with Microsoft</span>
          </>
        )}
      </button>

      {/* OR divider */}
      <div
        className="my-8 grid items-center gap-4 text-[16px]"
        style={{ gridTemplateColumns: "1fr auto 1fr", color: T.muted(theme) }}
      >
        <div className="h-px" style={{ background: T.borderStrong(theme) }} />
        <span>or</span>
        <div className="h-px" style={{ background: T.borderStrong(theme) }} />
      </div>

      {/* "Login as" label */}
      <p
        className="mb-4 text-[18px] font-bold"
        style={{ fontFamily: DISPLAY_FONT, letterSpacing: "-0.01em", color: T.text(theme) }}
      >
        Login as
      </p>

      {/* Role cards */}
      <div className="flex flex-col gap-3.5">
        {ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => onRoleClick(role)}
            className={cn(
              "group flex w-full items-center gap-4 rounded-xl px-4 py-[18px] text-left",
              "transition-all duration-150 hover:-translate-y-px"
            )}
            style={{
              background: T.panel(theme),
              border: `1px solid ${T.border(theme)}`,
              color: T.text(theme),
              boxShadow: "0 1px 2px rgba(16,24,40,0.04)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = role.accent;
              e.currentTarget.style.boxShadow = `0 0 0 3px ${role.accent}1f, 0 10px 24px -10px rgba(16,24,40,0.22)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = T.border(theme);
              e.currentTarget.style.boxShadow = "0 1px 2px rgba(16,24,40,0.04)";
            }}
          >
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25)]"
              style={{ background: role.gradient }}
            >
              {role.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span
                className="block text-[17px] font-bold leading-snug"
                style={{ fontFamily: DISPLAY_FONT, letterSpacing: "-0.01em", color: T.text(theme) }}
              >
                {role.title}
              </span>
              <span className="block text-sm leading-snug" style={{ color: T.muted(theme) }}>
                {role.desc}
              </span>
            </span>
            <ChevronRight
              className="h-[18px] w-[18px] shrink-0 transition-transform duration-200 group-hover:translate-x-1"
              style={{ color: T.muted(theme) }}
            />
          </button>
        ))}
      </div>

      {/* Footer */}
      <div
        className="mt-10 flex w-full items-center justify-center gap-2 text-sm"
        style={{ color: T.muted(theme) }}
      >
        <Lock className="h-4 w-4" />
        Secure and trusted by thousands of organizations
      </div>
    </>
  );
}

// ─── Credentials view ──────────────────────────────────────────────────────────

interface CredentialsViewProps {
  theme: "light" | "dark";
  role: RoleConfig;
  onBack: () => void;
}

function CredentialsView({ theme, role, onBack }: CredentialsViewProps) {
  const navigate = useNavigate();
  const { login, isLoading } = useAuthStore();

  const [identifier, setIdentifier] = useState<string>("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      const user = await login(identifier, password, role.key);
      console.log("Auth permissions:", user.permissions);
      toast.success(`Signed in as ${user.fullName}`);
      navigate(getDashboard(user.permissions, user.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    }
  };

  const focusBorder = "#3b82f6";

  const applyFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = focusBorder;
    e.currentTarget.style.boxShadow = "0 0 0 3px rgba(59,130,246,0.15)";
  };
  const clearFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    e.currentTarget.style.borderColor = T.border(theme);
    e.currentTarget.style.boxShadow = "none";
  };

  const handleForgot = () =>
    toast.info("Password reset is not configured in this demo.");

  const labelCls = "mb-1.5 block text-[13px] font-semibold";

  return (
    <>
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="mb-8 flex items-center gap-1.5 text-sm font-medium transition-opacity hover:opacity-70"
        style={{ color: T.muted(theme) }}
      >
        <ArrowLeft className="h-4 w-4" />
        Back to sign-in options
      </button>

      {/* Role badge */}
      <div className="mb-9 flex flex-col items-center text-center">
        <span
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_20px_-8px_rgba(16,24,40,0.4)]"
          style={{ background: role.gradient }}
        >
          <span className="scale-125">{role.icon}</span>
        </span>
        <h1
          className="mb-1.5 font-extrabold"
          style={{
            fontFamily: DISPLAY_FONT,
            fontSize: 34,
            lineHeight: 1.1,
            letterSpacing: "-0.03em",
            color: T.text(theme),
          }}
        >
          Sign in as {role.title}
        </h1>
        <p className="text-[15px]" style={{ color: T.muted(theme) }}>
          Enter your credentials to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Email or phone */}
        <div>
          <label htmlFor="identifier" className={labelCls} style={{ color: T.text(theme) }}>
            Email or phone number
          </label>
          <input
            id="identifier"
            type="text"
            placeholder="name@company.com"
            autoComplete="username"
            value={identifier}
            onChange={(e) => setIdentifier(e.target.value)}
            required
            className="w-full rounded-xl px-4 py-[15px] text-[15px] outline-none transition-all"
            style={inputStyle(theme)}
            onFocus={applyFocus}
            onBlur={clearFocus}
          />
        </div>

        {/* Password with eye toggle */}
        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label
              htmlFor="password"
              className="text-[13px] font-semibold"
              style={{ color: T.text(theme) }}
            >
              Password
            </label>
            <button
              type="button"
              onClick={handleForgot}
              className="text-[13px] font-medium transition-opacity hover:opacity-70"
              style={{ color: focusBorder }}
            >
              Forgot password?
            </button>
          </div>
          <div className="relative">
            <input
              id="password"
              type={showPw ? "text" : "password"}
              placeholder="Enter your password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full rounded-xl px-4 py-[15px] pr-12 text-[15px] outline-none transition-all"
              style={inputStyle(theme)}
              onFocus={applyFocus}
              onBlur={clearFocus}
            />
            <button
              type="button"
              onClick={() => setShowPw((v) => !v)}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-md p-1 transition-opacity hover:opacity-70"
              style={{ color: T.muted(theme) }}
              tabIndex={-1}
              aria-label={showPw ? "Hide password" : "Show password"}
            >
              {showPw ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <div
            className="flex items-start gap-2.5 rounded-xl px-3.5 py-3 text-[13px] font-medium"
            style={{
              background: tv(theme, "#fef2f2", "rgba(220,38,38,0.12)"),
              border: `1px solid ${tv(theme, "#fecaca", "rgba(248,113,113,0.35)")}`,
              color: tv(theme, "#b91c1c", "#fca5a5"),
            }}
          >
            <AlertCircle className="mt-px h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Sign In button */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "mt-2 flex w-full items-center justify-center gap-3 rounded-xl py-[18px]",
            "text-[16px] font-semibold text-white",
            "transition-all duration-150 hover:-translate-y-px hover:brightness-110",
            "disabled:opacity-70 disabled:pointer-events-none"
          )}
          style={{
            background: role.gradient,
            boxShadow: `0 10px 22px -10px ${role.accent}99`,
          }}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `Continue as ${role.title}`
          )}
        </button>
      </form>

      {/* Footer */}
      <div
        className="mt-9 flex w-full items-center justify-center gap-2 text-sm"
        style={{ color: T.muted(theme) }}
      >
        <Lock className="h-4 w-4" />
        Secure and trusted by thousands of organizations
      </div>
    </>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const { theme, setTheme } = useTheme();
  const [step, setStep] = useState<"roles" | "credentials">("roles");
  const [selectedRole, setSelectedRole] = useState<RoleConfig | null>(null);

  const handleRoleClick = (role: RoleConfig) => {
    setSelectedRole(role);
    setStep("credentials");
  };

  const handleBack = () => {
    setStep("roles");
    setSelectedRole(null);
  };

  return (
    <div className="grid h-screen w-screen overflow-hidden md:grid-cols-2">

      {/* ── LEFT: background image panel ──────────────────────────────────── */}
      <div
        className="relative hidden overflow-hidden md:block"
        style={{ backgroundColor: "#0a1430" }}
        aria-hidden="true"
      >
        <img
          src="/left-panel.png"
          alt=""
          className="absolute inset-0 h-full w-full"
          aria-hidden="true"
        />
        {/* Subtle inner shadow on right edge */}
        <div className="pointer-events-none absolute inset-0 shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]" />
      </div>

      {/* ── RIGHT: login panel ─────────────────────────────────────────────── */}
      <main
        className="relative flex items-center justify-center overflow-y-auto px-6 py-16 md:px-14"
        style={{ background: T.bg(theme) }}
      >
        {/* Theme toggle */}
        <div
          className="absolute right-6 top-7 z-10 flex rounded-full p-1 shadow-sm md:right-9"
          style={{
            background: T.panel(theme),
            border: `1px solid ${T.border(theme)}`,
          }}
        >
          {(["light", "dark"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTheme(t)}
              title={t === "light" ? "Light theme" : "Dark theme"}
              className={cn(
                "inline-flex h-8 w-9 items-center justify-center rounded-full transition-colors duration-200",
                theme === t
                  ? t === "light"
                    ? "bg-amber-50 text-amber-600"
                    : "bg-[#1c2a4d] text-[#c7d4ff]"
                  : "hover:opacity-70"
              )}
              style={{ color: theme === t ? undefined : T.muted(theme) }}
            >
              {t === "light" ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
            </button>
          ))}
        </div>

        {/* Card */}
        <div className="w-full max-w-[460px]">
          {step === "roles" ? (
            <RolesView theme={theme} onRoleClick={handleRoleClick} />
          ) : selectedRole ? (
            <CredentialsView theme={theme} role={selectedRole} onBack={handleBack} />
          ) : null}
        </div>
      </main>
    </div>
  );
}
