import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";

// ─── Enums (mirror backend) ───────────────────────────────────────────────────

export const CheckinCommentType = {
  FREEFORM: "freeform",
  STRUCTURED: "structured",
} as const;
export type CheckinCommentType =
  (typeof CheckinCommentType)[keyof typeof CheckinCommentType];

export const CheckinRatingSentiment = {
  POSITIVE: "positive",
  NEUTRAL: "neutral",
  NEEDS_ATTENTION: "needs_attention",
} as const;
export type CheckinRatingSentiment =
  (typeof CheckinRatingSentiment)[keyof typeof CheckinRatingSentiment];

export const SENTIMENT_LABEL: Record<CheckinRatingSentiment, string> = {
  positive: "On Track",
  neutral: "Neutral",
  needs_attention: "Needs Attention",
};

export const SENTIMENT_CHIP: Record<CheckinRatingSentiment, string> = {
  positive: "bg-tertiary-container text-on-tertiary-container",
  neutral: "bg-secondary-container text-on-secondary-container",
  needs_attention: "bg-error-container text-on-error-container",
};

// ─── Team status DTO ──────────────────────────────────────────────────────────

export interface TeamMemberStatus {
  employeeId: string;
  quarter: string;
  cycleId: string;
  weightedScore: number | null;
  goalsTotal: number;
  goalsSubmitted: number;
  goalsCompleted: number;
  achievementSubmitted: boolean;
  checkinDone: boolean;
  snapshotGeneratedAt: string | null;
}

// ─── Employee detail DTO ──────────────────────────────────────────────────────

export interface CheckinGoalEntry {
  id: string;
  title: string;
  thrustArea: string;
  uomType: string;
  targetValue: number | null;
  targetDate: string | null;
  weightage: number;
  status: string;
  achievement: CheckinAchievement | null;
}

export interface CheckinAchievement {
  id: string;
  goalId: string;
  quarter: string;
  actualValue: number | null;
  actualDate: string | null;
  status: string;
  computedScore: number | null;
  scoreFormulaUsed: string | null;
  submittedAt: string | null;
}

export interface CheckinRecord {
  id: string;
  managerId: string;
  employeeId: string;
  quarter: string;
  cycleId: string;
  comment: string;
  commentType: CheckinCommentType;
  goalsDiscussed: string[] | null;
  overallRatingSentiment: CheckinRatingSentiment | null;
  completedAt: string | null;
  isAcknowledgedByEmployee: boolean;
  acknowledgedAt: string | null;
  createdAt: string;
  updatedAt: string | null;
  managerName: string | null;
  employeeName: string | null;
}

export interface EmployeeCheckinDetail {
  employee: {
    id: string;
    fullName: string;
    email: string;
    role: string;
  };
  quarter: string;
  cycleId: string;
  goals: CheckinGoalEntry[];
  existingCheckin: CheckinRecord | null;
}

// ─── Input types ──────────────────────────────────────────────────────────────

export interface CreateCheckinInput {
  employeeId: string;
  cycleId: string;
  quarter: string;
  comment: string;
  commentType?: CheckinCommentType;
  goalsDiscussed?: string[];
  overallRatingSentiment?: CheckinRatingSentiment | null;
}

export interface UpdateCheckinInput {
  checkinId: string;
  comment?: string;
  commentType?: CheckinCommentType;
  goalsDiscussed?: string[];
  overallRatingSentiment?: CheckinRatingSentiment | null;
  editReason: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function mapCheckin(raw: Record<string, unknown>): CheckinRecord {
  return {
    id: raw["id"] as string,
    managerId: raw["manager_id"] as string,
    employeeId: raw["employee_id"] as string,
    quarter: raw["quarter"] as string,
    cycleId: raw["cycle_id"] as string,
    comment: raw["comment"] as string,
    commentType: raw["comment_type"] as CheckinCommentType,
    goalsDiscussed: (raw["goals_discussed"] as string[] | null) ?? null,
    overallRatingSentiment:
      (raw["overall_rating_sentiment"] as CheckinRatingSentiment | null) ?? null,
    completedAt: (raw["completed_at"] as string | null) ?? null,
    isAcknowledgedByEmployee: Boolean(raw["is_acknowledged_by_employee"]),
    acknowledgedAt: (raw["acknowledged_at"] as string | null) ?? null,
    createdAt: raw["created_at"] as string,
    updatedAt: (raw["updated_at"] as string | null) ?? null,
    managerName: (raw["manager_name"] as string | null) ?? null,
    employeeName: (raw["employee_name"] as string | null) ?? null,
  };
}

type NumericRaw = string | number | null | undefined;

function toNum(v: NumericRaw): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function mapAch(raw: Record<string, unknown>): CheckinAchievement {
  return {
    id: raw["id"] as string,
    goalId: raw["goal_id"] as string,
    quarter: raw["quarter"] as string,
    actualValue: toNum(raw["actual_value"] as NumericRaw),
    actualDate: (raw["actual_date"] as string | null) ?? null,
    status: raw["status"] as string,
    computedScore: toNum(raw["computed_score"] as NumericRaw),
    scoreFormulaUsed: (raw["score_formula_used"] as string | null) ?? null,
    submittedAt: (raw["submitted_at"] as string | null) ?? null,
  };
}

function mapDetail(raw: Record<string, unknown>): EmployeeCheckinDetail {
  const emp = raw["employee"] as Record<string, unknown>;
  const goals = (raw["goals"] as Record<string, unknown>[]).map((g) => ({
    id: g["id"] as string,
    title: g["title"] as string,
    thrustArea: g["thrust_area"] as string,
    uomType: (g["uom_type"] as string).toUpperCase(),
    targetValue: toNum(g["target_value"] as NumericRaw),
    targetDate: (g["target_date"] as string | null) ?? null,
    weightage: toNum(g["weightage"] as NumericRaw) ?? 0,
    status: g["status"] as string,
    achievement: g["achievement"]
      ? mapAch(g["achievement"] as Record<string, unknown>)
      : null,
  }));
  return {
    employee: {
      id: emp["id"] as string,
      fullName: emp["full_name"] as string,
      email: emp["email"] as string,
      role: emp["role"] as string,
    },
    quarter: raw["quarter"] as string,
    cycleId: raw["cycle_id"] as string,
    goals,
    existingCheckin: raw["existing_checkin"]
      ? mapCheckin(raw["existing_checkin"] as Record<string, unknown>)
      : null,
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const checkinService = {
  async getTeamStatus(quarter: string, cycleId: string): Promise<TeamMemberStatus[]> {
    const params = new URLSearchParams({ quarter, cycle_id: cycleId });
    const res = await apiClient.get<APIResponse<Record<string, unknown>[]>>(
      `/v1/checkins/team-status?${params.toString()}`
    );
    return res.data.map((r) => ({
      employeeId: r["employee_id"] as string,
      quarter: r["quarter"] as string,
      cycleId: r["cycle_id"] as string,
      weightedScore: toNum(r["weighted_score"] as NumericRaw),
      goalsTotal: (r["goals_total"] as number) ?? 0,
      goalsSubmitted: (r["goals_submitted"] as number) ?? 0,
      goalsCompleted: (r["goals_completed"] as number) ?? 0,
      achievementSubmitted: Boolean(r["achievement_submitted"]),
      checkinDone: Boolean(r["checkin_done"]),
      snapshotGeneratedAt: (r["snapshot_generated_at"] as string | null) ?? null,
    }));
  },

  async getEmployeeDetail(
    employeeId: string,
    quarter: string,
    cycleId: string
  ): Promise<EmployeeCheckinDetail> {
    const params = new URLSearchParams({ quarter, cycle_id: cycleId });
    const res = await apiClient.get<APIResponse<Record<string, unknown>>>(
      `/v1/checkins/employee/${employeeId}?${params.toString()}`
    );
    return mapDetail(res.data);
  },

  async createCheckin(input: CreateCheckinInput): Promise<CheckinRecord> {
    const body: Record<string, unknown> = {
      employee_id: input.employeeId,
      cycle_id: input.cycleId,
      quarter: input.quarter,
      comment: input.comment,
      comment_type: input.commentType ?? CheckinCommentType.FREEFORM,
    };
    if (input.goalsDiscussed?.length) body["goals_discussed"] = input.goalsDiscussed;
    if (input.overallRatingSentiment != null)
      body["overall_rating_sentiment"] = input.overallRatingSentiment;
    const res = await apiClient.post<APIResponse<Record<string, unknown>>>(
      "/v1/checkins/",
      body
    );
    return mapCheckin(res.data);
  },

  async updateCheckin(input: UpdateCheckinInput): Promise<CheckinRecord> {
    const body: Record<string, unknown> = { edit_reason: input.editReason };
    if (input.comment !== undefined) body["comment"] = input.comment;
    if (input.commentType !== undefined) body["comment_type"] = input.commentType;
    if (input.goalsDiscussed !== undefined) body["goals_discussed"] = input.goalsDiscussed;
    if (input.overallRatingSentiment !== undefined)
      body["overall_rating_sentiment"] = input.overallRatingSentiment;
    const res = await apiClient.patch<APIResponse<Record<string, unknown>>>(
      `/v1/checkins/${input.checkinId}`,
      body
    );
    return mapCheckin(res.data);
  },

  async getMyCheckins(quarter: string, cycleId: string): Promise<CheckinRecord[]> {
    const params = new URLSearchParams({ quarter, cycle_id: cycleId });
    const res = await apiClient.get<APIResponse<Record<string, unknown>[]>>(
      `/v1/checkins/my?${params.toString()}`
    );
    return res.data.map((r) => mapCheckin(r));
  },

  async acknowledgeCheckin(checkinId: string): Promise<CheckinRecord> {
    const res = await apiClient.post<APIResponse<Record<string, unknown>>>(
      `/v1/checkins/${checkinId}/acknowledge`,
      {}
    );
    return mapCheckin(res.data);
  },
};
