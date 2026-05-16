import { create } from "zustand";
import { differenceInDays, parseISO, isAfter, isBefore } from "date-fns";
import type { CycleConfig } from "@/types/cycle.types";
import { CyclePhase } from "@/types/cycle.types";
import { cycleService } from "@/services/cycle.service";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeDaysRemaining(windowClose: string): number {
  return Math.max(0, differenceInDays(parseISO(windowClose), new Date()));
}

function computeIsWindowOpen(windowOpen: string, windowClose: string): boolean {
  const now = new Date();
  return !isBefore(now, parseISO(windowOpen)) && !isAfter(now, parseISO(windowClose));
}

// ─── State ────────────────────────────────────────────────────────────────────

interface CycleState {
  activeWindow: CycleConfig | null;
  currentPhase: CyclePhase | null;
  isWindowOpen: boolean;
  daysRemaining: number;
  isLoading: boolean;
  loadError: string | null;

  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  getWindowStatusMessage: () => string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCycleStore = create<CycleState>()((set, get) => ({
  activeWindow: null,
  currentPhase: null,
  isWindowOpen: false,
  daysRemaining: 0,
  isLoading: false,
  loadError: null,

  initialize: async () => {
    if (get().activeWindow || get().isLoading) return;
    await get().refresh();
  },

  refresh: async () => {
    set({ isLoading: true, loadError: null });
    try {
      const status = await cycleService.getActive();
      if (!status.cycle) {
        set({
          activeWindow: null,
          currentPhase: null,
          isWindowOpen: false,
          daysRemaining: 0,
          isLoading: false,
        });
        return;
      }
      set({
        activeWindow: status.cycle,
        currentPhase: status.cycle.phase,
        isWindowOpen: status.isOpen,
        daysRemaining: status.daysRemaining,
        isLoading: false,
      });
    } catch (err) {
      set({
        isLoading: false,
        loadError: err instanceof Error ? err.message : "Failed to load cycle",
      });
    }
  },

  getWindowStatusMessage: () => {
    const { activeWindow, isWindowOpen, daysRemaining } = get();
    if (!activeWindow) return "No active cycle configured.";

    // Format the close date: "31 May 2026"
    const close = parseISO(activeWindow.windowClose);
    const dateStr = close.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const phaseLabel =
      activeWindow.phase === CyclePhase.GOAL_SETTING
        ? "Goal Setting Window"
        : `${activeWindow.phase} Review Window`;

    if (isWindowOpen) {
      return `${phaseLabel}: Open until ${dateStr} (${daysRemaining} day${
        daysRemaining === 1 ? "" : "s"
      } remaining)`;
    }
    return `${phaseLabel}: Window closed on ${dateStr}`;
  },
}));

// Re-export helpers to silence "unused" warnings if imported elsewhere.
export { computeIsWindowOpen, computeDaysRemaining };
