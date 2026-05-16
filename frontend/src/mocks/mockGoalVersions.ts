import { GoalStatus, UoMType } from "@/types/goal.types";
import type { GoalVersion } from "@/types/goal.types";
import { GOAL_IDS } from "./mockGoals";

// ─── Version history for Goal 1 (Rahul — Sales Revenue) ──────────────────────
// Shows manager editing the target from 45 → 50 Lakhs.

export const GOAL_1_VERSION_1: GoalVersion = {
  id: "gv-001-v1",
  goalId: GOAL_IDS.RAHUL_SALES_REVENUE,
  versionNumber: 1,
  title: "Achieve Q1 Sales Revenue Target",
  description: "Drive sales to achieve the Q1 revenue target of ₹45 Lakhs.",
  uomType: UoMType.MIN,
  targetValue: 45,
  weightage: 30,
  status: GoalStatus.DRAFT,
  changedBy: "u-rahul-verma",
  changedByName: "Rahul Verma",
  changeReason: "Initial draft submitted for manager review.",
  snapshotAt: "2025-04-10T09:00:00.000Z",
};

export const GOAL_1_VERSION_2: GoalVersion = {
  id: "gv-001-v2",
  goalId: GOAL_IDS.RAHUL_SALES_REVENUE,
  versionNumber: 2,
  title: "Achieve Q1 Sales Revenue Target",
  description:
    "Drive sales to achieve the Q1 revenue target of ₹50 Lakhs through new account acquisition and upselling to existing clients.",
  uomType: UoMType.MIN,
  targetValue: 50,
  weightage: 30,
  status: GoalStatus.UNDER_REVIEW,
  changedBy: "u-vikram-nair",
  changedByName: "Vikram Nair",
  changeReason:
    "Aligned with department target. Revenue target revised from ₹45L to ₹50L per Sales VP directive for FY2025.",
  snapshotAt: "2025-04-14T11:30:00.000Z",
};

export const GOAL_1_VERSION_3: GoalVersion = {
  id: "gv-001-v3",
  goalId: GOAL_IDS.RAHUL_SALES_REVENUE,
  versionNumber: 3,
  title: "Achieve Q1 Sales Revenue Target",
  description:
    "Drive sales to achieve the Q1 revenue target of ₹50 Lakhs through new account acquisition and upselling to existing clients.",
  uomType: UoMType.MIN,
  targetValue: 50,
  weightage: 30,
  status: GoalStatus.APPROVED,
  changedBy: "u-vikram-nair",
  changedByName: "Vikram Nair",
  changeReason: "Approved after aligning target with Sales department KPIs.",
  snapshotAt: "2025-04-18T14:30:00.000Z",
};

export const GOAL_1_VERSIONS: GoalVersion[] = [
  GOAL_1_VERSION_1,
  GOAL_1_VERSION_2,
  GOAL_1_VERSION_3,
];

export const mockGoalVersions: GoalVersion[] = [...GOAL_1_VERSIONS];

/** Lookup versions by goalId */
export const VERSIONS_BY_GOAL_ID: Record<string, GoalVersion[]> = {
  [GOAL_IDS.RAHUL_SALES_REVENUE]: GOAL_1_VERSIONS,
};
