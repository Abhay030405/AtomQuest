import { apiClient } from "./api-client";
import { GoalStatus, ThrustArea, UoMType } from "@/types/goal.types";
import type { Goal, GoalSheet, GoalSheetStatus, GoalVersion } from "@/types/goal.types";
import type { APIResponse } from "@/types/api.types";

// ─── Enum case helpers (backend = lower_snake, frontend = UPPER_SNAKE) ────────

function toApiEnum(value: string): string {
  return value.toLowerCase();
}

function fromApiUoM(value: string): UoMType {
  const up = value.toUpperCase() as keyof typeof UoMType;
  return UoMType[up] ?? UoMType.MIN;
}

function fromApiThrust(value: string): ThrustArea {
  const up = value.toUpperCase() as keyof typeof ThrustArea;
  return ThrustArea[up] ?? ThrustArea.REVENUE_GROWTH;
}

function fromApiStatus(value: string): GoalStatus {
  if (value === "under_review") return GoalStatus.UNDER_REVIEW;
  return value as GoalStatus;
}

function fromApiSheetStatus(value: string | null | undefined): GoalSheetStatus | undefined {
  if (!value) return undefined;
  if (value === GoalStatus.DRAFT || value === GoalStatus.SUBMITTED || value === GoalStatus.APPROVED) {
    return value;
  }
  return undefined;
}

// ─── Backend DTOs ─────────────────────────────────────────────────────────────

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
}

interface ApiGoalVersion {
  id: string;
  goal_id: string;
  version_number: number;
  title: string;
  description?: string | null;
  thrust_area: string;
  uom_type: string;
  target_value?: string | number | null;
  target_date?: string | null;
  weightage: string | number;
  status: string;
  changed_by: string;
  changed_by_name: string;
  change_reason?: string | null;
  snapshot_at: string;
}

interface ApiPaginatedGoals {
  items: ApiGoal[];
  meta?: unknown;
}

interface ApiPaginatedSheets {
  items: ApiGoalSheet[];
  meta?: unknown;
}

interface ApiGoalWithVersions extends ApiGoal {
  versions: ApiGoalVersion[];
}

interface ApiSheetSubmitResponse {
  message: string;
  sheet: ApiGoalSheet;
  locked_at: string;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

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
    status: fromApiSheetStatus(s.status) ?? GoalStatus.DRAFT,
    goals: s.goals.map(mapApiGoal),
    totalWeightage: Number(s.total_weightage),
    submittedAt: s.submitted_at ?? undefined,
    approvedAt: s.approved_at ?? undefined,
  };
}

function mapApiVersion(v: ApiGoalVersion): GoalVersion {
  const tv = v.target_value;
  return {
    id: v.id,
    goalId: v.goal_id,
    versionNumber: v.version_number,
    title: v.title,
    description: v.description ?? undefined,
    uomType: fromApiUoM(v.uom_type),
    targetValue: tv === null || tv === undefined ? null : Number(tv),
    targetDate: v.target_date ?? undefined,
    weightage: Number(v.weightage),
    status: fromApiStatus(v.status),
    changedBy: v.changed_by,
    changedByName: v.changed_by_name,
    changeReason: v.change_reason ?? undefined,
    snapshotAt: v.snapshot_at,
  };
}

// ─── Payload builders ─────────────────────────────────────────────────────────

function buildGoalCreatePayload(payload: {
  title: string;
  description?: string;
  thrustArea: ThrustArea;
  uomType: UoMType;
  targetValue: number | null;
  targetDate?: string;
  weightage: number;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {
    title: payload.title,
    description: payload.description ?? null,
    thrust_area: toApiEnum(payload.thrustArea),
    uom_type: toApiEnum(payload.uomType),
    weightage: payload.weightage,
  };
  if (payload.uomType === UoMType.TIMELINE) {
    body.target_value = null;
    body.target_date = payload.targetDate ?? null;
  } else if (payload.uomType === UoMType.ZERO) {
    body.target_value = 0;
    body.target_date = null;
  } else {
    body.target_value = payload.targetValue;
    body.target_date = null;
  }
  return body;
}

function unwrap<T>(resp: APIResponse<T>, fallback: string): T {
  if (!resp.success || resp.data === null || resp.data === undefined) {
    throw new Error(resp.error?.message ?? fallback);
  }
  return resp.data;
}

// ─── Goal Service ─────────────────────────────────────────────────────────────

export const goalService = {
  // userId is kept for React Query key compatibility — backend derives the
  // authenticated user from the bearer token.
  getMyGoals: async (_userId: string, cycleId?: string): Promise<Goal[]> => {
    if (!cycleId) return [];
    const resp = await apiClient.get<APIResponse<ApiPaginatedGoals>>(
      `/v1/goals/?cycle_id=${encodeURIComponent(cycleId)}&page_size=100`
    );
    const data = unwrap(resp, "Failed to load goals");
    return data.items.map(mapApiGoal);
  },

  getMySheet: async (_userId: string, cycleId: string): Promise<GoalSheet | null> => {
    const resp = await apiClient.get<APIResponse<ApiGoalSheet | null>>(
      `/v1/goals/my-sheet?cycle_id=${encodeURIComponent(cycleId)}`
    );
    if (!resp.success) throw new Error(resp.error?.message ?? "Failed to load sheet");
    return resp.data ? mapApiSheet(resp.data) : null;
  },

  createGoal: async (
    payload: Omit<Goal, "id" | "version" | "status" | "isShared" | "createdAt" | "updatedAt">
  ): Promise<Goal> => {
    const body = buildGoalCreatePayload(payload);
    const resp = await apiClient.post<APIResponse<ApiGoal>>("/v1/goals/", body);
    return mapApiGoal(unwrap(resp, "Failed to create goal"));
  },

  updateGoal: async (id: string, patch: Partial<Goal>): Promise<Goal> => {
    const body: Record<string, unknown> = { id };
    if (patch.title !== undefined) body.title = patch.title;
    if (patch.description !== undefined) body.description = patch.description ?? null;
    if (patch.thrustArea !== undefined) body.thrust_area = toApiEnum(patch.thrustArea);
    if (patch.uomType !== undefined) body.uom_type = toApiEnum(patch.uomType);
    if (patch.weightage !== undefined) body.weightage = patch.weightage;
    if (patch.uomType === undefined) {
      if (patch.targetValue !== undefined) body.target_value = patch.targetValue;
      if (patch.targetDate !== undefined) body.target_date = patch.targetDate ?? null;
    } else if (patch.uomType === UoMType.TIMELINE) {
      body.target_value = null;
      body.target_date = patch.targetDate ?? null;
    } else if (patch.uomType === UoMType.ZERO) {
      body.target_value = 0;
      body.target_date = null;
    } else {
      body.target_value = patch.targetValue ?? null;
      body.target_date = null;
    }
    const resp = await apiClient.patch<APIResponse<ApiGoal>>(`/v1/goals/${id}`, body);
    return mapApiGoal(unwrap(resp, "Failed to update goal"));
  },

  deleteGoal: async (id: string): Promise<{ id: string }> => {
    const resp = await apiClient.delete<APIResponse<{ message: string }>>(`/v1/goals/${id}`);
    if (!resp.success) throw new Error(resp.error?.message ?? "Failed to delete goal");
    return { id };
  },

  submitSheet: async (userId: string, cycleId: string): Promise<GoalSheet> => {
    // Backend submit-sheet requires the sheet UUID. Resolve it from my-sheet.
    const sheet = await goalService.getMySheet(userId, cycleId);
    if (!sheet) throw new Error("Goal sheet not found");
    const resp = await apiClient.post<APIResponse<ApiSheetSubmitResponse>>(
      "/v1/goals/submit-sheet",
      { sheet_id: sheet.id }
    );
    const data = unwrap(resp, "Failed to submit sheet");
    return mapApiSheet(data.sheet);
  },

  getGoalVersions: async (goalId: string): Promise<GoalVersion[]> => {
    const resp = await apiClient.get<APIResponse<ApiGoalWithVersions>>(
      `/v1/goals/${goalId}/versions`
    );
    const data = unwrap(resp, "Failed to load goal versions");
    return data.versions.map(mapApiVersion);
  },

  // ─── Manager / admin endpoints ─────────────────────────────────────────────

  getTeamGoals: async (_managerId: string, cycleId?: string): Promise<Goal[]> => {
    if (!cycleId) return [];
    const resp = await apiClient.get<APIResponse<ApiPaginatedSheets>>(
      `/v1/goals/team?cycle_id=${encodeURIComponent(cycleId)}&page_size=100`
    );
    const data = unwrap(resp, "Failed to load team goals");
    return data.items.flatMap((sheet) => sheet.goals.map(mapApiGoal));
  },

  getAllGoals: async (cycleId?: string): Promise<Goal[]> => {
    if (!cycleId) return [];
    const resp = await apiClient.get<APIResponse<ApiPaginatedGoals>>(
      `/v1/goals/?cycle_id=${encodeURIComponent(cycleId)}&page_size=200`
    );
    const data = unwrap(resp, "Failed to load goals");
    return data.items.map(mapApiGoal);
  },
};
