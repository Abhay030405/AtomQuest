import { NavLink, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Target,
  CalendarCheck,
  ClipboardCheck,
  Users,
  CheckSquare,
  Settings2,
  Share2,
  FileSearch,
  BarChart3,
  LockOpen,
  LogOut,
  X,
} from "lucide-react";
import { useAuthStore } from "@/store/authStore";
import { Permission } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";
import { getRoleDisplayName, getRoleColor } from "@/utils/permission.util";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

// ─── Nav item shape ────────────────────────────────────────────────────────────

interface NavItem {
  label: string;
  to: string;
  icon: LucideIcon;
  comingSoon?: string;
}

interface NavSection {
  /** Must hold this permission to see this entire section */
  anchor: Permission;
  items: NavItem[];
}

// ─── Nav sections — checked in priority order ─────────────────────────────────
// Admin: has CONFIGURE_CYCLE (exclusive to admin)
// Manager: has APPROVE_GOAL but not CONFIGURE_CYCLE
// Employee: has SUBMIT_GOAL_SHEET (exclusive to employees)

const NAV_SECTIONS: NavSection[] = [
  {
    anchor: Permission.CONFIGURE_CYCLE,
    items: [
      { label: "Dashboard", to: ROUTES.ADMIN.ROOT, icon: LayoutDashboard },
      { label: "Cycle Config", to: ROUTES.ADMIN.CYCLES, icon: Settings2 },
      { label: "Shared Goals", to: ROUTES.ADMIN.SHARED_GOALS, icon: Share2 },
      { label: "Audit Trail", to: ROUTES.ADMIN.AUDIT, icon: FileSearch },
      { label: "Reports", to: ROUTES.ADMIN.REPORTS, icon: BarChart3 },
      { label: "Goal Unlock", to: ROUTES.ADMIN.GOAL_UNLOCK, icon: LockOpen },
    ],
  },
  {
    anchor: Permission.APPROVE_GOAL,
    items: [
      { label: "Dashboard", to: ROUTES.MANAGER.ROOT, icon: LayoutDashboard },
      { label: "Approval Queue", to: ROUTES.MANAGER.REVIEW, icon: ClipboardCheck },
      { label: "Team Goals", to: ROUTES.MANAGER.TEAM_GOALS, icon: Users },
      { label: "Check-in Module", to: ROUTES.MANAGER.CHECKIN, icon: CheckSquare },
    ],
  },
  {
    anchor: Permission.SUBMIT_GOAL_SHEET,
    items: [
      { label: "Dashboard", to: ROUTES.EMPLOYEE.ROOT, icon: LayoutDashboard },
      { label: "My Goals", to: ROUTES.EMPLOYEE.GOALS, icon: Target },
      { label: "Quarterly Update", to: ROUTES.EMPLOYEE.QUARTERLY_UPDATE, icon: CalendarCheck },
    ],
  },
];

// ─── Nav item renderer ─────────────────────────────────────────────────────────

function SidebarNavItem({ item }: { item: NavItem }) {
  if (item.comingSoon) {
    return (
      <div className="flex items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground/50 cursor-not-allowed select-none">
        <item.icon className="h-4 w-4 shrink-0" />
        <span className="flex-1">{item.label}</span>
        <span className="rounded text-[10px] font-medium bg-muted px-1.5 py-0.5 text-muted-foreground/60">
          {item.comingSoon}
        </span>
      </div>
    );
  }

  return (
    <NavLink
      to={item.to}
      end={item.to.split("/").length <= 2}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "border-l-2 border-indigo-600 bg-indigo-50 text-indigo-700 pl-[10px]"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )
      }
    >
      <item.icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </NavLink>
  );
}

// ─── Sidebar content ───────────────────────────────────────────────────────────

interface SidebarContentProps {
  onClose?: () => void;
}

function SidebarContent({ onClose }: SidebarContentProps) {
  const navigate = useNavigate();
  const { currentUser, logout, hasPermission } = useAuthStore();

  // Pick the first section whose anchor permission the user holds
  const activeSection = NAV_SECTIONS.find((s) => hasPermission(s.anchor));
  const navItems = activeSection?.items ?? [];

  const handleLogout = () => {
    logout();
    navigate(ROUTES.LOGIN);
  };

  return (
    <div className="flex h-full flex-col bg-card border-r">
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-5 border-b shrink-0">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-600">
            <Target className="h-4 w-4 text-white" />
          </div>
          <div className="flex flex-col leading-none">
            <span className="text-sm font-bold text-indigo-700">AtomQuest</span>
            <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
              Portal
            </span>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-0.5">
        {navItems.map((item) => (
          <SidebarNavItem key={item.to + item.label} item={item} />
        ))}
      </nav>

      {/* User card */}
      {currentUser && (
        <div className="border-t px-4 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {currentUser.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold truncate text-foreground">
                {currentUser.fullName}
              </p>
              <Badge
                variant="secondary"
                className={cn("text-[10px] px-1.5 py-0 mt-0.5", getRoleColor(currentUser.role))}
              >
                {getRoleDisplayName(currentUser.role)}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-muted-foreground hover:text-foreground"
            onClick={handleLogout}
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </Button>
        </div>
      )}
    </div>
  );
}

// ─── Exported Sidebar ──────────────────────────────────────────────────────────

export function Sidebar() {
  return (
    <aside className="hidden md:flex w-[260px] shrink-0 flex-col h-screen sticky top-0">
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
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/40 md:hidden"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Drawer */}
      <div className="fixed inset-y-0 left-0 z-50 w-[260px] md:hidden shadow-xl">
        <SidebarContent onClose={onClose} />
      </div>
    </>
  );
}
