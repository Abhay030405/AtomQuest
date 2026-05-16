import { useCycleStore } from "@/store/cycleStore";

type BannerVariant = "info" | "warning" | "error" | "success";

function getBannerVariant(daysRemaining: number, isWindowOpen: boolean): BannerVariant {
  if (!isWindowOpen) return "error";
  if (daysRemaining <= 3) return "warning";
  if (daysRemaining <= 7) return "info";
  return "success";
}

export function useWindowStatus() {
  const activeWindow = useCycleStore((s) => s.activeWindow);
  const currentPhase = useCycleStore((s) => s.currentPhase);
  const isWindowOpen = useCycleStore((s) => s.isWindowOpen);
  const daysRemaining = useCycleStore((s) => s.daysRemaining);
  const getWindowStatusMessage = useCycleStore((s) => s.getWindowStatusMessage);

  const bannerVariant = getBannerVariant(daysRemaining, isWindowOpen);
  const statusMessage = getWindowStatusMessage();

  return {
    activeWindow,
    currentPhase,
    isWindowOpen,
    daysRemaining,
    statusMessage,
    bannerVariant,
  };
}
