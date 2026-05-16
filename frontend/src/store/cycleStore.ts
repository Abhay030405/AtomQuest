import { create } from "zustand";
import { differenceInDays, parseISO, isAfter, isBefore } from "date-fns";
import type { CycleConfig } from "@/types/cycle.types";
import { CyclePhase } from "@/types/cycle.types";
import { CYCLE_FY2026 } from "@/mocks/mockCycleConfig";

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

  initialize: () => void;
  getWindowStatusMessage: () => string;
}

// ─── Store ────────────────────────────────────────────────────────────────────

export const useCycleStore = create<CycleState>()((set, get) => ({
  activeWindow: null,
  currentPhase: null,
  isWindowOpen: false,
  daysRemaining: 0,

  initialize: () => {
    const cycle = CYCLE_FY2026;
    const isWindowOpen = computeIsWindowOpen(cycle.windowOpen, cycle.windowClose);
    const daysRemaining = computeDaysRemaining(cycle.windowClose);
    set({
      activeWindow: cycle,
      currentPhase: cycle.phase as CyclePhase,
      isWindowOpen,
      daysRemaining,
    });
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
