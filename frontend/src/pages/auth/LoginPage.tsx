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
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/authStore";
import { mockUsers } from "@/mocks/mockUsers";
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

function getDashboard(permissions: string[]): string {
  if (permissions.includes(Permission.CONFIGURE_CYCLE)) return ROUTES.ADMIN.ROOT;
  if (permissions.includes(Permission.APPROVE_GOAL)) return ROUTES.MANAGER.ROOT;
  return ROUTES.EMPLOYEE.ROOT;
}

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLES = [
  {
    key: "employee",
    title: "Employee",
    desc: "Access your goals and track progress",
    email: "rahul.verma@atomberg.com",
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
    email: "vikram.nair@atomberg.com",
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
    email: "priya.sharma@atomberg.com",
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

// ─── CSS vars shorthand per theme ──────────────────────────────────────────────

function tv(theme: "light" | "dark", light: string, dark: string) {
  return theme === "dark" ? dark : light;
}

const T = {
  bg:         (t: "light" | "dark") => tv(t, "#f3f4f7", "#0b1220"),
  panel:      (t: "light" | "dark") => tv(t, "#ffffff",  "#111a2e"),
  border:     (t: "light" | "dark") => tv(t, "#e5e7ee",  "#1f2a44"),
  borderStrong:(t: "light" | "dark") => tv(t, "#d8dbe4", "#2a3656"),
  text:       (t: "light" | "dark") => tv(t, "#0b1220",  "#f1f5fb"),
  muted:      (t: "light" | "dark") => tv(t, "#5b6477",  "#9aa3b7"),
  inputBg:    (t: "light" | "dark") => tv(t, "#f3f4f7",  "#0b1220"),
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
      <div className="mb-8 text-center">
        <h1
          className="mb-3 font-bold"
          style={{ fontSize: 44, lineHeight: 1.05, letterSpacing: "-0.02em", color: T.text(theme) }}
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
          "flex w-full items-center justify-center gap-3.5 rounded-2xl px-5 py-[18px]",
          "text-[17px] font-semibold shadow-[0_1px_2px_rgba(15,23,42,0.04),0_1px_1px_rgba(15,23,42,0.02)]",
          "transition-all duration-150 hover:-translate-y-px",
          "hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)]",
          "hover:border-[var(--border-s)] disabled:pointer-events-none disabled:opacity-75"
        )}
        style={{
          background: T.panel(theme),
          border: `1px solid ${T.border(theme)}`,
          color: T.text(theme),
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
        className="my-7 grid items-center gap-4 text-[16px]"
        style={{ gridTemplateColumns: "1fr auto 1fr", color: T.muted(theme) }}
      >
        <div className="h-px" style={{ background: T.borderStrong(theme) }} />
        <span>or</span>
        <div className="h-px" style={{ background: T.borderStrong(theme) }} />
      </div>

      {/* "Login as" label */}
      <p className="mb-3.5 text-[18px] font-bold" style={{ color: T.text(theme) }}>
        Login as
      </p>

      {/* Role cards */}
      <div className="flex flex-col gap-3">
        {ROLES.map((role) => (
          <button
            key={role.key}
            type="button"
            onClick={() => onRoleClick(role)}
            className={cn(
              "group flex w-full items-center gap-4 rounded-2xl px-4 py-4 text-left",
              "shadow-[0_1px_2px_rgba(15,23,42,0.04)]",
              "transition-all duration-150 hover:-translate-y-px",
              "hover:shadow-[0_8px_24px_-8px_rgba(15,23,42,0.12),0_2px_6px_rgba(15,23,42,0.06)]"
            )}
            style={{
              background: T.panel(theme),
              border: `1px solid ${T.border(theme)}`,
              color: T.text(theme),
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = T.borderStrong(theme))}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = T.border(theme))}
          >
            <span
              className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-white"
              style={{ background: role.gradient }}
            >
              {role.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-[17px] font-bold leading-snug" style={{ color: T.text(theme) }}>
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
        className="mt-7 flex w-full items-center justify-center gap-2 text-sm"
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

  const [identifier, setIdentifier] = useState<string>(role.email);
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      // identifier may be email or phone — look up by email in mock
      const emailToUse = identifier.includes("@")
        ? identifier
        : role.email; // fallback to role email if phone entered
      await login(emailToUse, password || "password");
      const user = mockUsers.find(
        (u) => u.email.toLowerCase() === emailToUse.toLowerCase()
      );
      if (user) {
        toast.success(`Signed in as ${user.fullName}`);
        navigate(getDashboard(user.permissions));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid credentials. Please try again.");
    }
  };

  const focusBorder = "#3b82f6";

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
      <div className="mb-8 flex flex-col items-center text-center">
        <span
          className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl text-white shadow-lg"
          style={{ background: role.gradient }}
        >
          <span className="scale-125">{role.icon}</span>
        </span>
        <h1
          className="mb-1.5 font-bold"
          style={{ fontSize: 36, lineHeight: 1.1, letterSpacing: "-0.02em", color: T.text(theme) }}
        >
          Sign in as {role.title}
        </h1>
        <p className="text-[15px]" style={{ color: T.muted(theme) }}>
          Enter your credentials to continue
        </p>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-3">
        {/* Phone or email */}
        <input
          type="text"
          placeholder="Phone number or email"
          autoComplete="username"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          required
          className="w-full rounded-xl px-4 py-3.5 text-[15px] outline-none transition-all"
          style={inputStyle(theme)}
          onFocus={(e) => (e.currentTarget.style.borderColor = focusBorder)}
          onBlur={(e) => (e.currentTarget.style.borderColor = T.border(theme))}
        />

        {/* Password with eye toggle */}
        <div className="relative">
          <input
            type={showPw ? "text" : "password"}
            placeholder="Password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full rounded-xl px-4 py-3.5 pr-12 text-[15px] outline-none transition-all"
            style={inputStyle(theme)}
            onFocus={(e) => (e.currentTarget.style.borderColor = focusBorder)}
            onBlur={(e) => (e.currentTarget.style.borderColor = T.border(theme))}
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

        {/* Error */}
        {error && (
          <p
            className="rounded-xl px-4 py-2.5 text-sm"
            style={{ background: "#fef2f2", color: "#dc2626" }}
          >
            {error}
          </p>
        )}

        {/* Sign In button */}
        <button
          type="submit"
          disabled={isLoading}
          className={cn(
            "flex w-full items-center justify-center gap-3 rounded-xl py-4",
            "text-[16px] font-semibold text-white",
            "transition-all duration-150 hover:-translate-y-px hover:brightness-110",
            "disabled:opacity-70 disabled:pointer-events-none"
          )}
          style={{ background: role.gradient }}
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            `Continue as ${role.title}`
          )}
        </button>
      </form>

      {/* Demo hint */}
      <p
        className="mt-5 text-center text-xs"
        style={{ color: T.muted(theme) }}
      >
        Demo mode — any password accepted
      </p>

      {/* Footer */}
      <div
        className="mt-6 flex w-full items-center justify-center gap-2 text-sm"
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
        className="relative flex items-center justify-center overflow-y-auto px-6 py-12 md:px-14"
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
