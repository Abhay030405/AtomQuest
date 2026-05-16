import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Bell,
  Info,
  AlertTriangle,
  CheckCircle2,
  Zap,
  Menu,
  Check,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { PAGE_TITLES } from "@/constants/routes";
import { getRoleDisplayName, getRoleColor } from "@/utils/permission.util";
import { timeAgo } from "@/utils/date.util";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification";

// ─── Notification icon per type ───────────────────────────────────────────────

function NotifIcon({ type }: { type: Notification["type"] }) {
  const cls = "h-4 w-4 shrink-0 mt-0.5";
  switch (type) {
    case "success":
      return <CheckCircle2 className={cn(cls, "text-emerald-500")} />;
    case "warning":
      return <AlertTriangle className={cn(cls, "text-amber-500")} />;
    case "action":
      return <Zap className={cn(cls, "text-indigo-500")} />;
    default:
      return <Info className={cn(cls, "text-blue-500")} />;
  }
}

// ─── Notification dropdown ────────────────────────────────────────────────────

function NotificationPanel() {
  const navigate = useNavigate();
  const { notifications, unreadCount, markRead, markAllRead } =
    useNotificationStore();

  const recent = notifications.slice(0, 5);

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold">Notifications</h3>
          {unreadCount > 0 && (
            <Badge className="h-4 px-1.5 text-[10px] bg-red-500 hover:bg-red-500">
              {unreadCount}
            </Badge>
          )}
        </div>
        {unreadCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs text-muted-foreground"
            onClick={markAllRead}
          >
            <Check className="mr-1 h-3 w-3" />
            Mark all read
          </Button>
        )}
      </div>

      {/* List */}
      <div className="max-h-[360px] overflow-y-auto">
        {recent.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            No notifications
          </p>
        ) : (
          recent.map((n) => (
            <button
              key={n.id}
              className={cn(
                "w-full flex items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50",
                !n.read && "bg-blue-50/60"
              )}
              onClick={() => {
                markRead(n.id);
                if (n.actionUrl) navigate(n.actionUrl);
              }}
            >
              <NotifIcon type={n.type} />
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-start justify-between gap-2">
                  <p className={cn("text-xs font-medium leading-snug", !n.read && "text-foreground")}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="mt-0.5 h-2 w-2 shrink-0 rounded-full bg-red-500" />
                  )}
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                  {n.message}
                </p>
                <p className="text-[10px] text-muted-foreground/70">
                  {timeAgo(n.createdAt)}
                </p>
              </div>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      {notifications.length > 5 && (
        <>
          <Separator />
          <div className="py-2 text-center">
            <Button variant="ghost" size="sm" className="text-xs text-indigo-600">
              View all notifications
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

interface TopbarProps {
  onMobileMenuClick: () => void;
}

export function Topbar({ onMobileMenuClick }: TopbarProps) {
  const { pathname } = useLocation();
  const { currentUser } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);

  // Page title: try exact match, then longest prefix match
  const pageTitle =
    PAGE_TITLES[pathname] ??
    Object.entries(PAGE_TITLES)
      .filter(([path]) => pathname.startsWith(path + "/"))
      .sort(([a], [b]) => b.length - a.length)[0]?.[1] ??
    "AtomQuest Portal";

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b bg-card px-4 md:px-6 shadow-sm">
      {/* Left: hamburger (mobile) + page title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={onMobileMenuClick}
        >
          <Menu className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold text-foreground">{pageTitle}</h1>
      </div>

      {/* Right: notification bell + user info */}
      <div className="flex items-center gap-2">
        {/* Notification bell */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              {unreadCount > 0 && (
                <span className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white">
                  {unreadCount > 9 ? "9+" : unreadCount}
                </span>
              )}
            </Button>
          </PopoverTrigger>
          <PopoverContent
            className="w-80 p-0 shadow-xl"
            align="end"
            sideOffset={8}
          >
            <NotificationPanel />
          </PopoverContent>
        </Popover>

        {/* User name + role badge (desktop only) */}
        {currentUser && (
          <div className="hidden md:flex items-center gap-2">
            <Avatar className="h-7 w-7">
              <AvatarFallback className="bg-indigo-100 text-indigo-700 text-xs font-semibold">
                {currentUser.avatarInitials}
              </AvatarFallback>
            </Avatar>
            <span className="text-sm font-medium text-foreground">
              {currentUser.fullName.split(" ")[0]}
            </span>
            <Badge
              variant="secondary"
              className={cn("text-xs", getRoleColor(currentUser.role))}
            >
              {getRoleDisplayName(currentUser.role)}
            </Badge>
          </div>
        )}
      </div>
    </header>
  );
}
