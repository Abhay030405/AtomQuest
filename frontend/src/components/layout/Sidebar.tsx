import { NavLink, useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";
import { getRoleDisplayName } from "@/utils/permission.util";
import { cn } from "@/lib/utils";

// ─── Nav item shape ────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: string;
}

interface NavSection {
  anchor: Permission;
  label: string;
  subtitle: string;
  initials: string;
  items: (userId: string) => NavItem[];
}

// ─── Nav sections ──────────────────────────────────────────────────────────────

const NAV_SECTIONS: NavSection[] = [
  {
    anchor: Permission.CONFIGURE_CYCLE,
    label: "Admin Console",
    subtitle: "Global Operations",
    initials: "AC",
    items: (userId) => [
      { label: "Dashboard", to: ROUTES.ADMIN.ROOT(userId), icon: "dashboard" },
      { label: "View Personnel", to: ROUTES.ADMIN.PERSONNEL(userId), icon: "groups" },
      { label: "Cycle Config", to: ROUTES.ADMIN.CYCLES(userId), icon: "track_changes" },
      { label: "Shared Goals", to: ROUTES.ADMIN.SHARED_GOALS(userId), icon: "domain" },
      { label: "Audit Trail", to: ROUTES.ADMIN.AUDIT(userId), icon: "history" },
      { label: "Reports", to: ROUTES.ADMIN.REPORTS(userId), icon: "analytics" },
      { label: "Goal Unlock", to: ROUTES.ADMIN.GOAL_UNLOCK(userId), icon: "lock_open_right" },
    ],
  },
  {
    anchor: Permission.APPROVE_GOAL,
    label: "Manager Portal",
    subtitle: "Enterprise Performance",
    initials: "MP",
    items: (userId) => [
      { label: "Dashboard", to: ROUTES.MANAGER.ROOT(userId), icon: "dashboard" },
      { label: "Approval Queue", to: ROUTES.MANAGER.REVIEW(userId), icon: "fact_check" },
      { label: "Team Goals", to: ROUTES.MANAGER.TEAM_GOALS(userId), icon: "track_changes" },
      { label: "Check-in Module", to: ROUTES.MANAGER.CHECKIN(userId), icon: "event_note" },
    ],
  },
  {
    anchor: Permission.SUBMIT_GOAL_SHEET,
    label: "AtomQuest",
    subtitle: "Performance Hub",
    initials: "AQ",
    items: (userId) => [
      { label: "Dashboard", to: ROUTES.EMPLOYEE.ROOT(userId), icon: "dashboard" },
      { label: "My Goals", to: ROUTES.EMPLOYEE.GOALS(userId), icon: "target" },
      { label: "Quarterly Update", to: ROUTES.EMPLOYEE.QUARTERLY_UPDATE(userId), icon: "task_alt" },
    ],
  },
];

// ─── Sidebar content ───────────────────────────────────────────────────────────

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const navigate = useNavigate();
  const { currentUser, logout, hasPermission } = useAuthStore();

  const activeSection = NAV_SECTIONS.find((s) => hasPermission(s.anchor));
  const navItems = currentUser?.id ? activeSection?.items(currentUser.id) ?? [] : [];

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-full flex-col bg-surface-container-lowest border-r border-outline-variant">
      {/* Brand header */}
      <div className="flex items-center justify-between px-lg py-lg border-b border-outline-variant shrink-0">
        <div className="flex items-center gap-md">
          <div className="w-10 h-10 rounded-lg bg-primary-container flex items-center justify-center text-on-primary-container font-bold text-sm shrink-0">
            {activeSection?.initials ?? "AQ"}
          </div>
          <div>
            <h1 className="text-title-md font-bold text-primary leading-tight">{activeSection?.label ?? "AtomQuest"}</h1>
            <p className="text-label-md text-on-surface-variant">{activeSection?.subtitle ?? "Performance Hub"}</p>
          </div>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-on-surface-variant hover:bg-surface-container-low p-1 rounded-full transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-md py-md flex flex-col gap-xs">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to.split("/").length <= 3}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-md px-md py-sm rounded-lg text-label-md font-medium transition-all duration-200 cursor-pointer active:scale-95",
                isActive
                  ? "bg-secondary-container text-on-secondary-container font-bold"
                  : "text-on-surface-variant hover:bg-surface-container-low"
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className={cn("material-symbols-outlined text-[20px]", isActive ? "fill" : "")}>
                  {item.icon}
                </span>
                <span>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* User + logout */}
      {currentUser && (
        <div className="border-t border-outline-variant px-md py-md shrink-0 flex flex-col gap-sm">
          <div className="flex items-center gap-md px-md py-sm">
            <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold shrink-0">
              {currentUser.avatarInitials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-body-md font-semibold text-on-surface truncate">{currentUser.fullName}</p>
              <p className="text-label-md text-on-surface-variant">{getRoleDisplayName(currentUser.role)}</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-md px-md py-sm rounded-lg text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[20px]">logout</span>
            <span>Sign Out</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Exported Sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-64 shrink-0 flex-col h-screen sticky top-0 z-40">
      <SidebarContent />
    </aside>
  );
}

// ─── Mobile drawer variant ─────────────────────────────────────────────────────

interface MobileSidebarProps {
  open: boolean;
  onClose: () => void;
}

export function MobileSidebar({ open, onClose }: MobileSidebarProps) {
  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="fixed inset-y-0 left-0 z-50 w-64 md:hidden shadow-level-3">
        <SidebarContent onClose={onClose} />
      </div>
    </>
  );
}
