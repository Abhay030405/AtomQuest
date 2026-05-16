import { mockGoals, mockGoalSheets } from "@/mocks/mockGoals";
import { mockGoalVersions } from "@/mocks/mockGoalVersions";
import { mockAuditLogs } from "@/mocks/mockAuditLogs";
import { CYCLE_FY2025, CYCLE_FY2026 } from "@/mocks/mockCycleConfig";
import type { Goal, GoalSheet, GoalVersion } from "@/types/goal.types";
import type { AuditLog } from "@/types/audit.types";
import type { CycleConfig } from "@/types/cycle.types";

// Mutable in-memory session store — reset on page reload.
export const db = {
  goals: [...mockGoals] as Goal[],
  goalSheets: [...mockGoalSheets] as GoalSheet[],
  goalVersions: [...mockGoalVersions] as GoalVersion[],
  auditLogs: [...mockAuditLogs] as AuditLog[],
  cycleConfigs: [CYCLE_FY2025, CYCLE_FY2026] as CycleConfig[],
};
