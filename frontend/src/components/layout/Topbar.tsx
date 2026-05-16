import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuthStore } from "@/store/authStore";
import { useNotificationStore } from "@/store/notificationStore";
import { timeAgo } from "@/utils/date.util";
import { cn } from "@/lib/utils";
import type { Notification } from "@/types/notification";

// ─── Notification icon per type ───────────────────────────────────────────────

function notifIcon(type: Notification["type"]): string {
  switch (type) {
    case "success": return "check_circle";
    case "warning": return "warning";
    case "action": return "bolt";
    default: return "info";
  }
}

function notifIconColor(type: Notification["type"]): string {
  switch (type) {
    case "success": return "text-tertiary bg-tertiary/10";
    case "warning": return "text-[#b45309] bg-[#fef3c7]";
    case "action": return "text-primary bg-primary/10";
    default: return "text-secondary bg-secondary-container";
  }
}

// ─── Notification dropdown ────────────────────────────────────────────────────

function NotificationPanel({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const currentUser = useAuthStore((s) => s.currentUser);
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const recent = notifications.slice(0, 6);

  return (
    <div className="flex flex-col w-80">
      <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
        <div className="flex items-center gap-sm">
          <h3 className="text-title-md text-on-surface">Notifications</h3>
          {unreadCount > 0 && (
            <span className="bg-error text-on-error text-label-md font-bold px-1.5 py-0.5 rounded-full text-[10px]">
              {unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={() => void markAllRead()}
            className="text-label-md text-primary hover:underline"
          >
            Mark all read
          </button>
        )}
      </div>

      <div className="max-h-80 overflow-y-auto">
        {recent.length === 0 ? (
          <p className="py-8 text-center text-body-md text-on-surface-variant">
            No notifications
          </p>
        ) : (
          recent.map((n) => (
            <button
              key={n.id}
              className={cn(
                "w-full flex items-start gap-md px-md py-sm text-left transition-colors hover:bg-surface-container-low border-b border-outline-variant/50 last:border-0",
                !n.read && "bg-primary-fixed/20"
              )}
              onClick={() => {
                if (currentUser?.id) {
                  void markRead(n.id, currentUser.id);
                }
                if (n.actionUrl) {
                  navigate(n.actionUrl);
                  onClose();
                }
              }}
            >
              <div className={cn("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", notifIconColor(n.type))}>
                <span className="material-symbols-outlined text-[16px]">{notifIcon(n.type)}</span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-sm">
                  <p className={cn("text-body-md leading-snug", !n.read ? "text-on-surface font-medium" : "text-on-surface-variant")}>
                    {n.title}
                  </p>
                  {!n.read && (
                    <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-error" />
                  )}
                </div>
                <p className="text-label-md text-on-surface-variant mt-0.5 line-clamp-2">{n.message}</p>
                <p className="text-[10px] text-on-surface-variant/70 mt-xs">{timeAgo(n.createdAt)}</p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

// ─── Topbar ───────────────────────────────────────────────────────────────────

interface TopbarProps {
  onMobileMenuClick: () => void;
}

export function Topbar({ onMobileMenuClick }: TopbarProps) {
  const { currentUser } = useAuthStore();
  const { unreadCount } = useNotificationStore();
  const [notifOpen, setNotifOpen] = useState(false);

  return (
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between border-b border-outline-variant bg-surface-container-lowest px-lg shadow-level-1">
      {/* Left: mobile menu + search */}
      <div className="flex items-center gap-md flex-1">
        <button
          className="md:hidden text-on-surface-variant hover:bg-surface-container-low p-sm rounded-full transition-colors"
          onClick={onMobileMenuClick}
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        {/* Search bar — desktop only */}
        <div className="relative hidden md:flex items-center w-64">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-on-surface-variant text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search..."
            className="w-full pl-9 pr-md py-1.5 bg-surface-container-low border border-outline-variant rounded-full text-body-md text-on-surface placeholder:text-on-surface-variant focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all"
          />
        </div>
      </div>

      {/* Right: notifications + user */}
      <div className="flex items-center gap-sm">
        {/* Notification bell */}
        <Popover open={notifOpen} onOpenChange={setNotifOpen}>
          <PopoverTrigger asChild>
            <button className="relative text-on-surface-variant hover:bg-surface-container-low p-sm rounded-full transition-colors cursor-pointer">
              <span className="material-symbols-outlined">notifications</span>
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="p-0 shadow-level-2 border-outline-variant" align="end" sideOffset={8}>
            <NotificationPanel onClose={() => setNotifOpen(false)} />
          </PopoverContent>
        </Popover>

        <button className="text-on-surface-variant hover:bg-surface-container-low p-sm rounded-full transition-colors cursor-pointer hidden md:flex">
          <span className="material-symbols-outlined">help_outline</span>
        </button>

        {/* User avatar */}
        {currentUser && (
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-bold cursor-pointer border border-outline-variant ml-xs">
            {currentUser.avatarInitials}
          </div>
        )}
      </div>
    </header>
  );
}
