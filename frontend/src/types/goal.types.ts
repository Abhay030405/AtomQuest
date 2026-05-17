// ─── Const objects (erasableSyntaxOnly compatible, used exactly like enums) ───

export const GoalStatus = {
  DRAFT: "draft",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under-review",
  APPROVED: "approved",
  LOCKED: "locked",
  ARCHIVED: "archived",
} as const;
export type GoalStatus = (typeof GoalStatus)[keyof typeof GoalStatus];

/** MIN = Higher is better (e.g. Sales Revenue, Units Produced)
 *  MAX = Lower is better (e.g. TAT, Cost, Error Rate)
 *  TIMELINE = Date-based completion (Deadline driven)
 *  ZERO = Zero equals success (e.g. Safety Incidents, Complaints) */
export const UoMType = {
  MIN: "MIN",
  MAX: "MAX",
  TIMELINE: "TIMELINE",
  ZERO: "ZERO",
} as const;
export type UoMType = (typeof UoMType)[keyof typeof UoMType];

export const ThrustArea = {
  REVENUE_GROWTH: "REVENUE_GROWTH",
  CUSTOMER_SATISFACTION: "CUSTOMER_SATISFACTION",
  OPERATIONAL_EXCELLENCE: "OPERATIONAL_EXCELLENCE",
  PEOPLE_DEVELOPMENT: "PEOPLE_DEVELOPMENT",
  SAFETY_COMPLIANCE: "SAFETY_COMPLIANCE",
  INNOVATION: "INNOVATION",
  COST_OPTIMISATION: "COST_OPTIMISATION",
  QUALITY: "QUALITY",
} as const;
export type ThrustArea = (typeof ThrustArea)[keyof typeof ThrustArea];

export const GoalEventType = {
  CREATED: "CREATED",
  EDITED: "EDITED",
  SUBMITTED: "SUBMITTED",
  RETURNED_FOR_REWORK: "RETURNED_FOR_REWORK",
  APPROVED: "APPROVED",
  REJECTED: "REJECTED",
  LOCKED: "LOCKED",
  UNLOCKED: "UNLOCKED",
  ARCHIVED: "ARCHIVED",
  SHARED: "SHARED",
} as const;
export type GoalEventType = (typeof GoalEventType)[keyof typeof GoalEventType];

// GoalSheet status is the subset of GoalStatus that a sheet can be in
export type GoalSheetStatus =
  | typeof GoalStatus.DRAFT
  | typeof GoalStatus.SUBMITTED
  | typeof GoalStatus.APPROVED;

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface Goal {
  id: string;
  title: string;
  description?: string;
  thrustArea: ThrustArea;
  uomType: UoMType;
  /** For TIMELINE type this is null; use targetDate instead */
  targetValue: number | null;
  /** ISO date string — only relevant for TIMELINE goals */
  targetDate?: string;
  weightage: number;
  status: GoalStatus;
  isShared: boolean;
  sourceSharedGoalId?: string;
  /** Parent goal-sheet id — needed to dispatch sheet-level approve/return actions */
  goalSheetId?: string;
  version: number;
  lockedAt?: string;
  lockedBy?: string;
  cycleId: string;
  createdAt: string;
  updatedAt: string;
  userId: string;
}

export interface GoalSheet {
  id: string;
  userId: string;
  cycleId: string;
  status: GoalSheetStatus;
  goals: Goal[];
  totalWeightage: number;
  submittedAt?: string;
  approvedAt?: string;
  employeeName?: string;
  employeeRole?: string;
  cycleName?: string;
  returnedCount?: number;
}

export interface GoalVersion {
  id: string;
  goalId: string;
  versionNumber: number;
  title: string;
  description?: string;
  uomType: UoMType;
  targetValue: number | null;
  targetDate?: string;
  weightage: number;
  status: GoalStatus;
  changedBy: string;
  changedByName: string;
  changeReason?: string;
  snapshotAt: string;
}

export interface GoalEvent {
  id: string;
  goalId: string;
  eventType: GoalEventType;
  actorId: string;
  actorName: string;
  payload?: Record<string, unknown>;
  occurredAt: string;
}
