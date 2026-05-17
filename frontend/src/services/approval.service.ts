import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";
import type { Goal, GoalSheet } from "@/types/goal.types";
import { GoalStatus, ThrustArea, UoMType } from "@/types/goal.types";

interface ApiGoal {
  id: string;
  user_id: string;
  goal_sheet_id: string;
  cycle_id: string;
  title: string;
  description?: string | null;
  thrust_area: string;
  uom_type: string;
  target_value?: string | number | null;
  target_date?: string | null;
  weightage: string | number;
  status: string;
  is_shared: boolean;
  source_shared_goal_id?: string | null;
  version: number;
  locked_at?: string | null;
  locked_by?: string | null;
  created_at: string;
  updated_at?: string | null;
  owner_name?: string | null;
  sheet_status?: string | null;
}

interface ApiGoalSheet {
  id: string;
  user_id: string;
  cycle_id: string;
  status: string;
  goals: ApiGoal[];
  total_weightage: string | number;
  submitted_at?: string | null;
  approved_at?: string | null;
  approved_by_name?: string | null;
  returned_count?: number;
  cycle_name?: string | null;
  owner_name?: string | null;
}

function fromApiUoM(value: string): UoMType {
  return UoMType[value.toUpperCase() as keyof typeof UoMType] ?? UoMType.MIN;
}

function fromApiThrust(value: string): ThrustArea {
  return ThrustArea[value.toUpperCase() as keyof typeof ThrustArea] ?? ThrustArea.REVENUE_GROWTH;
}

function fromApiStatus(value: string): GoalStatus {
  if (value === "under_review") return GoalStatus.UNDER_REVIEW;
  return value as GoalStatus;
}

function mapApiGoal(g: ApiGoal): Goal {
  const tv = g.target_value;
  return {
    id: g.id,
    userId: g.user_id,
    cycleId: g.cycle_id,
    title: g.title,
    description: g.description ?? undefined,
    thrustArea: fromApiThrust(g.thrust_area),
    uomType: fromApiUoM(g.uom_type),
    targetValue: tv === null || tv === undefined ? null : Number(tv),
    targetDate: g.target_date ?? undefined,
    weightage: Number(g.weightage),
    status: fromApiStatus(g.status),
    isShared: g.is_shared,
    sourceSharedGoalId: g.source_shared_goal_id ?? undefined,
    version: g.version,
    lockedAt: g.locked_at ?? undefined,
    lockedBy: g.locked_by ?? undefined,
    createdAt: g.created_at,
    updatedAt: g.updated_at ?? g.created_at,
  };
}

function mapApiSheet(s: ApiGoalSheet): GoalSheet {
  return {
    id: s.id,
    userId: s.user_id,
    cycleId: s.cycle_id,
    status: (s.status as GoalSheet["status"]) ?? GoalStatus.DRAFT,
    goals: s.goals.map(mapApiGoal),
    totalWeightage: Number(s.total_weightage),
    submittedAt: s.submitted_at ?? undefined,
    approvedAt: s.approved_at ?? undefined,
    employeeName: s.owner_name ?? undefined,
    cycleName: s.cycle_name ?? undefined,
    returnedCount: s.returned_count,
  };
}

function unwrap<T>(resp: APIResponse<T>, fallback: string): T {
  if (!resp.success || resp.data === null || resp.data === undefined) {
    throw new Error(resp.error?.message ?? fallback);
  }
  return resp.data;
}

export const approvalService = {
  getPendingApprovals: async (): Promise<GoalSheet[]> => {
    const resp = await apiClient.get<APIResponse<ApiGoalSheet[]>>("/v1/approvals/pending");
    return unwrap(resp, "Failed to load pending approvals").map(mapApiSheet);
  },

  getSheetForReview: async (sheetId: string): Promise<GoalSheet> => {
    const resp = await apiClient.get<APIResponse<ApiGoalSheet>>(`/v1/approvals/${sheetId}`);
    return mapApiSheet(unwrap(resp, "Failed to load goal sheet"));
  },

  approveSheet: async (sheetId: string, _approverId: string): Promise<GoalSheet> => {
    const resp = await apiClient.post<APIResponse<ApiGoalSheet>>(
      `/v1/approvals/${sheetId}/approve`,
      {}
    );
    return mapApiSheet(unwrap(resp, "Failed to approve sheet"));
  },

  returnForRework: async (sheetId: string, reason: string): Promise<GoalSheet> => {
    const resp = await apiClient.post<APIResponse<ApiGoalSheet>>(
      `/v1/approvals/${sheetId}/return-for-rework`,
      { reason }
    );
    return mapApiSheet(unwrap(resp, "Failed to return sheet"));
  },

  inlineEditGoal: async (
    sheetId: string,
    goalId: string,
    patch: { targetValue?: number | null; targetDate?: string | null; weightage?: number; changeReason: string }
  ): Promise<Goal> => {
    const body: Record<string, unknown> = { change_reason: patch.changeReason };
    if (patch.targetValue !== undefined) body.target_value = patch.targetValue;
    if (patch.targetDate !== undefined) body.target_date = patch.targetDate;
    if (patch.weightage !== undefined) body.weightage = patch.weightage;
    const resp = await apiClient.patch<APIResponse<ApiGoal>>(
      `/v1/approvals/${sheetId}/goals/${goalId}`,
      body
    );
    return mapApiGoal(unwrap(resp, "Failed to edit goal"));
  },
};
