export const CyclePhase = {
  GOAL_SETTING: "GOAL_SETTING",
  Q1: "Q1",
  Q2: "Q2",
  Q3: "Q3",
  Q4: "Q4",
} as const;
export type CyclePhase = (typeof CyclePhase)[keyof typeof CyclePhase];

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface CycleConfig {
  id: string;
  cycleName: string;
  phase: CyclePhase;
  windowOpen: string;
  windowClose: string;
  isActive: boolean;
  createdBy: string;
}

export interface WindowStatus {
  isOpen: boolean;
  phase: CyclePhase;
  daysRemaining: number;
  openDate: string;
  closeDate: string;
  message: string;
}
