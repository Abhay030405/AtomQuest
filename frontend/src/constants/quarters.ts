import { CyclePhase } from "@/types/cycle.types";

export interface QuarterDef {
  phase: CyclePhase;
  label: string;
  shortLabel: string;
  /** 1-indexed calendar months (April = 4 for Indian FY) */
  months: number[];
  /** Approx ISO month strings for date range display */
  startMonth: string;
  endMonth: string;
}

/** Indian financial year quarters (Apr–Mar) */
export const QUARTERS: QuarterDef[] = [
  {
    phase: CyclePhase.Q1,
    label: "Quarter 1",
    shortLabel: "Q1",
    months: [4, 5, 6],
    startMonth: "April",
    endMonth: "June",
  },
  {
    phase: CyclePhase.Q2,
    label: "Quarter 2",
    shortLabel: "Q2",
    months: [7, 8, 9],
    startMonth: "July",
    endMonth: "September",
  },
  {
    phase: CyclePhase.Q3,
    label: "Quarter 3",
    shortLabel: "Q3",
    months: [10, 11, 12],
    startMonth: "October",
    endMonth: "December",
  },
  {
    phase: CyclePhase.Q4,
    label: "Quarter 4",
    shortLabel: "Q4",
    months: [1, 2, 3],
    startMonth: "January",
    endMonth: "March",
  },
];

export const GOAL_SETTING_PHASE: QuarterDef = {
  phase: CyclePhase.GOAL_SETTING,
  label: "Goal Setting",
  shortLabel: "GS",
  months: [4],
  startMonth: "April",
  endMonth: "April",
};

/** Map CyclePhase → QuarterDef for O(1) lookup */
export const PHASE_MAP: Record<CyclePhase, QuarterDef> = {
  [CyclePhase.GOAL_SETTING]: GOAL_SETTING_PHASE,
  ...Object.fromEntries(QUARTERS.map((q) => [q.phase, q])),
} as Record<CyclePhase, QuarterDef>;
