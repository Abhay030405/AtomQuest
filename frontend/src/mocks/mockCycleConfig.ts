import { CyclePhase } from "@/types/cycle.types";
import type { CycleConfig, WindowStatus } from "@/types/cycle.types";

// ─── Cycles ──────────────────────────────────────────────────────────────────

/** Previous closed cycle (FY2025) — goals from this cycle are LOCKED */
export const CYCLE_FY2025: CycleConfig = {
  id: "cycle-fy2025",
  cycleName: "FY 2025",
  phase: CyclePhase.Q4,
  windowOpen: "2025-04-01T00:00:00.000Z",
  windowClose: "2025-03-31T23:59:59.000Z",
  isActive: false,
  createdBy: "u-priya-sharma",
};

/** Active cycle (FY2026) — goal-setting window currently open */
export const CYCLE_FY2026: CycleConfig = {
  id: "cycle-fy2026",
  cycleName: "FY 2026",
  phase: CyclePhase.GOAL_SETTING,
  windowOpen: "2026-05-01T00:00:00.000Z",
  windowClose: "2026-05-31T23:59:59.000Z",
  isActive: true,
  createdBy: "u-priya-sharma",
};

export const mockCycles: CycleConfig[] = [CYCLE_FY2025, CYCLE_FY2026];

export const CYCLES_BY_ID: Record<string, CycleConfig> = Object.fromEntries(
  mockCycles.map((c) => [c.id, c])
);

// ─── Current window status (computed from CYCLE_FY2026) ───────────────────────

const today = new Date("2026-05-16T10:00:00.000Z");
const closeDate = new Date(CYCLE_FY2026.windowClose);
const daysRemaining = Math.max(
  0,
  Math.ceil((closeDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
);

export const CURRENT_WINDOW_STATUS: WindowStatus = {
  isOpen: true,
  phase: CyclePhase.GOAL_SETTING,
  daysRemaining,
  openDate: CYCLE_FY2026.windowOpen,
  closeDate: CYCLE_FY2026.windowClose,
  message: `Goal-setting window is open. ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} remaining to submit your goals.`,
};
