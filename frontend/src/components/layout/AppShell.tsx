import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar, MobileSidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { WindowStatusBanner } from "@/components/shared/WindowStatusBanner";
import { useAuthStore } from "@/store/authStore";
import { useCycleStore } from "@/store/cycleStore";
import { useNotificationStore } from "@/store/notificationStore";
import { useWindowStatus } from "@/hooks/useWindowStatus";

export function AppShell() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const currentUser = useAuthStore((s) => s.currentUser);

  // Boot stores on mount
  const cycleInit = useCycleStore((s) => s.initialize);
  const notifInit = useNotificationStore((s) => s.initialize);

  useEffect(() => {
    cycleInit();
  }, [cycleInit]);

  useEffect(() => {
    if (currentUser?.id) {
      notifInit(currentUser.id);
    }
  }, [currentUser?.id, notifInit]);

  const { isWindowOpen, daysRemaining, activeWindow, bannerVariant } =
    useWindowStatus();

  const showBanner = Boolean(activeWindow);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Mobile sidebar drawer */}
      <MobileSidebar open={mobileOpen} onClose={() => setMobileOpen(false)} />

      {/* Main column */}
      <div className="flex flex-1 flex-col overflow-hidden min-w-0">
        <Topbar onMobileMenuClick={() => setMobileOpen(true)} />

        <main className="flex-1 flex flex-col overflow-hidden">
          {/* Window status banner */}
          {showBanner && (
            <WindowStatusBanner
              isOpen={isWindowOpen}
              daysRemaining={daysRemaining}
              closeDate={activeWindow!.windowClose}
              openDate={activeWindow!.windowOpen}
              variant={bannerVariant}
            />
          )}

          {/* Page content */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="mx-auto max-w-7xl px-4 py-6 md:px-6 h-full">
              <Outlet />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
