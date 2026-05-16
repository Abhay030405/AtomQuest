import { GoalStatus, UoMType, ThrustArea } from "@/types/goal.types";
import type { Goal, GoalSheet } from "@/types/goal.types";

// ─── IDs (exported for cross-file references) ─────────────────────────────────

export const GOAL_IDS = {
  RAHUL_SALES_REVENUE: "g-rahul-sales-revenue",
  RAHUL_CUSTOMER_TAT: "g-rahul-customer-tat",
  RAHUL_TRAINING_CERT: "g-rahul-training-cert",
  RAHUL_SAFETY: "g-rahul-safety",
  RAHUL_NEW_CLIENTS: "g-rahul-new-clients",
  SNEHA_ONBOARDING: "g-sneha-onboarding",
  SNEHA_NPS: "g-sneha-nps",
  SNEHA_UPSELL: "g-sneha-upsell",
} as const;

const CYCLE_FY2025 = "cycle-fy2025";
const CYCLE_FY2026 = "cycle-fy2026";
const RAHUL_ID = "u-rahul-verma";
const SNEHA_ID = "u-sneha-patel";

// ─── Rahul's goals (FY2025 — locked after approval) ──────────────────────────

export const RAHUL_GOAL_1: Goal = {
  id: GOAL_IDS.RAHUL_SALES_REVENUE,
  title: "Achieve Q1 Sales Revenue Target",
  description:
    "Drive sales to achieve the Q1 revenue target of ₹50 Lakhs through new account acquisition and upselling to existing clients.",
  thrustArea: ThrustArea.REVENUE_GROWTH,
  uomType: UoMType.MIN,
  targetValue: 50,
  weightage: 30,
  status: GoalStatus.LOCKED,
  isShared: false,
  version: 2,
  lockedAt: "2026-04-01T06:00:00.000Z",
  lockedBy: "u-priya-sharma",
  cycleId: CYCLE_FY2025,
  createdAt: "2025-04-10T09:00:00.000Z",
  updatedAt: "2026-04-01T06:00:00.000Z",
  userId: RAHUL_ID,
};

export const RAHUL_GOAL_2: Goal = {
  id: GOAL_IDS.RAHUL_CUSTOMER_TAT,
  title: "Reduce Customer TAT",
  description:
    "Reduce the average turnaround time for customer issue resolution from 5 days to 2 days.",
  thrustArea: ThrustArea.CUSTOMER_SATISFACTION,
  uomType: UoMType.MAX,
  targetValue: 2,
  weightage: 25,
  status: GoalStatus.LOCKED,
  isShared: false,
  version: 1,
  lockedAt: "2026-04-01T06:00:00.000Z",
  lockedBy: "u-priya-sharma",
  cycleId: CYCLE_FY2025,
  createdAt: "2025-04-10T09:15:00.000Z",
  updatedAt: "2026-04-01T06:00:00.000Z",
  userId: RAHUL_ID,
};

export const RAHUL_GOAL_3: Goal = {
  id: GOAL_IDS.RAHUL_TRAINING_CERT,
  title: "Complete Product Training Certification",
  description:
    "Complete the Atomberg Advanced Product Portfolio certification by June 30 2026 to improve product knowledge and sales effectiveness.",
  thrustArea: ThrustArea.PEOPLE_DEVELOPMENT,
  uomType: UoMType.TIMELINE,
  targetValue: null,
  targetDate: "2026-06-30",
  weightage: 20,
  status: GoalStatus.LOCKED,
  isShared: false,
  version: 1,
  lockedAt: "2026-04-01T06:00:00.000Z",
  lockedBy: "u-priya-sharma",
  cycleId: CYCLE_FY2025,
  createdAt: "2025-04-10T09:30:00.000Z",
  updatedAt: "2026-04-01T06:00:00.000Z",
  userId: RAHUL_ID,
};

export const RAHUL_GOAL_4: Goal = {
  id: GOAL_IDS.RAHUL_SAFETY,
  title: "Zero Safety Incidents",
  description:
    "Maintain zero reportable safety incidents throughout the financial year by following all safety protocols and conducting monthly safety checks.",
  thrustArea: ThrustArea.SAFETY_COMPLIANCE,
  uomType: UoMType.ZERO,
  targetValue: 0,
  weightage: 15,
  status: GoalStatus.LOCKED,
  isShared: false,
  version: 1,
  lockedAt: "2026-04-01T06:00:00.000Z",
  lockedBy: "u-priya-sharma",
  cycleId: CYCLE_FY2025,
  createdAt: "2025-04-10T09:45:00.000Z",
  updatedAt: "2026-04-01T06:00:00.000Z",
  userId: RAHUL_ID,
};

// ─── Rahul's FY2026 draft goal (goal-setting phase) ──────────────────────────

export const RAHUL_GOAL_5: Goal = {
  id: GOAL_IDS.RAHUL_NEW_CLIENTS,
  title: "Launch 3 New Client Accounts",
  description:
    "Identify, pitch, and onboard 3 new enterprise client accounts in the FY2026 Q1 goal-setting period.",
  thrustArea: ThrustArea.REVENUE_GROWTH,
  uomType: UoMType.MIN,
  targetValue: 3,
  weightage: 10,
  status: GoalStatus.DRAFT,
  isShared: false,
  version: 1,
  cycleId: CYCLE_FY2026,
  createdAt: "2026-05-05T10:00:00.000Z",
  updatedAt: "2026-05-05T10:00:00.000Z",
  userId: RAHUL_ID,
};

// ─── Sneha's goals (FY2026 — awaiting manager approval) ──────────────────────

export const SNEHA_GOAL_1: Goal = {
  id: GOAL_IDS.SNEHA_ONBOARDING,
  title: "Onboard 10 New Distributor Partners",
  description:
    "Identify and onboard 10 new distributor partners in Tier-2 cities to expand Atomberg's sales network.",
  thrustArea: ThrustArea.REVENUE_GROWTH,
  uomType: UoMType.MIN,
  targetValue: 10,
  weightage: 40,
  status: GoalStatus.SUBMITTED,
  isShared: false,
  version: 1,
  cycleId: CYCLE_FY2026,
  createdAt: "2026-05-03T09:00:00.000Z",
  updatedAt: "2026-05-10T12:00:00.000Z",
  userId: SNEHA_ID,
};

export const SNEHA_GOAL_2: Goal = {
  id: GOAL_IDS.SNEHA_NPS,
  title: "Achieve NPS Score of 70+",
  description:
    "Drive customer satisfaction initiatives to achieve a Net Promoter Score (NPS) of 70 or above by end of FY2026.",
  thrustArea: ThrustArea.CUSTOMER_SATISFACTION,
  uomType: UoMType.MIN,
  targetValue: 70,
  weightage: 35,
  status: GoalStatus.SUBMITTED,
  isShared: false,
  version: 1,
  cycleId: CYCLE_FY2026,
  createdAt: "2026-05-03T09:20:00.000Z",
  updatedAt: "2026-05-10T12:00:00.000Z",
  userId: SNEHA_ID,
};

export const SNEHA_GOAL_3: Goal = {
  id: GOAL_IDS.SNEHA_UPSELL,
  title: "Upsell Premium SKUs — 25% Revenue Mix",
  description:
    "Increase the share of premium SKU sales to 25% of total revenue by Q2 through targeted upsell campaigns.",
  thrustArea: ThrustArea.REVENUE_GROWTH,
  uomType: UoMType.MIN,
  targetValue: 25,
  weightage: 25,
  status: GoalStatus.SUBMITTED,
  isShared: false,
  version: 1,
  cycleId: CYCLE_FY2026,
  createdAt: "2026-05-03T09:40:00.000Z",
  updatedAt: "2026-05-10T12:00:00.000Z",
  userId: SNEHA_ID,
};

// ─── Goal collections ─────────────────────────────────────────────────────────

export const RAHUL_GOALS_LOCKED: Goal[] = [
  RAHUL_GOAL_1,
  RAHUL_GOAL_2,
  RAHUL_GOAL_3,
  RAHUL_GOAL_4,
];

export const SNEHA_GOALS: Goal[] = [SNEHA_GOAL_1, SNEHA_GOAL_2, SNEHA_GOAL_3];

export const mockGoals: Goal[] = [
  ...RAHUL_GOALS_LOCKED,
  RAHUL_GOAL_5,
  ...SNEHA_GOALS,
];

// ─── Goal Sheets ──────────────────────────────────────────────────────────────

/** Rahul's approved sheet from FY2025 (contains locked goals 1–4) */
export const RAHUL_SHEET_FY2025: GoalSheet = {
  id: "gs-rahul-fy2025",
  userId: RAHUL_ID,
  cycleId: CYCLE_FY2025,
  status: GoalStatus.APPROVED,
  goals: RAHUL_GOALS_LOCKED,
  totalWeightage: 90,
  submittedAt: "2025-04-15T09:00:00.000Z",
  approvedAt: "2025-04-18T14:30:00.000Z",
};

/** Rahul's in-progress draft sheet for FY2026 */
export const RAHUL_SHEET_FY2026: GoalSheet = {
  id: "gs-rahul-fy2026",
  userId: RAHUL_ID,
  cycleId: CYCLE_FY2026,
  status: GoalStatus.DRAFT,
  goals: [RAHUL_GOAL_5],
  totalWeightage: 10,
};

/** Sneha's submitted sheet awaiting approval */
export const SNEHA_SHEET_FY2026: GoalSheet = {
  id: "gs-sneha-fy2026",
  userId: SNEHA_ID,
  cycleId: CYCLE_FY2026,
  status: GoalStatus.SUBMITTED,
  goals: SNEHA_GOALS,
  totalWeightage: 100,
  submittedAt: "2026-05-10T12:00:00.000Z",
};

export const mockGoalSheets: GoalSheet[] = [
  RAHUL_SHEET_FY2025,
  RAHUL_SHEET_FY2026,
  SNEHA_SHEET_FY2026,
];
