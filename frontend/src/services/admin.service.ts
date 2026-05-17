import { db } from "./_mockDB";
import { mockRequestOrThrow } from "./api.client";
import { apiClient } from "./api-client";
import { GoalStatus, ThrustArea, UoMType } from "@/types/goal.types";
import type { APIResponse, PaginatedResponse } from "@/types/api.types";
import type { CycleConfig, CyclePhase } from "@/types/cycle.types";
import type { AuditLog, AuditAction } from "@/types/audit.types";
import type { Goal } from "@/types/goal.types";
import type { UserRole } from "@/types/user.types";

// ─── Cycle API DTOs ───────────────────────────────────────────────────────────

interface CycleApi {
  id: string;
  cycle_name: string;
  phase: string;
  window_open: string;
  window_close: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
}

function toApiPhase(phase: CyclePhase): string {
  // Backend uses lowercase enum values (e.g. "goal_setting", "q1").
  return String(phase).toLowerCase();
}

function fromApiPhase(value: string): CyclePhase {
  // Backend returns lowercase; frontend type uses uppercase keys.
  return value.toUpperCase() as CyclePhase;
}

function mapCycle(c: CycleApi): CycleConfig {
  return {
    id: c.id,
    cycleName: c.cycle_name,
    phase: fromApiPhase(c.phase),
    windowOpen: c.window_open,
    windowClose: c.window_close,
    isActive: c.is_active,
    createdBy: c.created_by ?? "",
  };
}

interface ApiPushedGoal {
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
}

function mapPushedGoal(g: ApiPushedGoal): Goal {
  const tv = g.target_value;
  const upperThrust = g.thrust_area.toUpperCase() as keyof typeof ThrustArea;
  const upperUom = g.uom_type.toUpperCase() as keyof typeof UoMType;
  return {
    id: g.id,
    userId: g.user_id,
    cycleId: g.cycle_id,
    title: g.title,
    description: g.description ?? undefined,
    thrustArea: ThrustArea[upperThrust] ?? ThrustArea.REVENUE_GROWTH,
    uomType: UoMType[upperUom] ?? UoMType.MIN,
    targetValue: tv === null || tv === undefined ? null : Number(tv),
    targetDate: g.target_date ?? undefined,
    weightage: Number(g.weightage),
    status: (g.status === "under_review" ? GoalStatus.UNDER_REVIEW : g.status) as Goal["status"],
    isShared: g.is_shared,
    sourceSharedGoalId: g.source_shared_goal_id ?? undefined,
    goalSheetId: g.goal_sheet_id ?? undefined,
    version: g.version,
    lockedAt: g.locked_at ?? undefined,
    lockedBy: g.locked_by ?? undefined,
    createdAt: g.created_at,
    updatedAt: g.updated_at ?? g.created_at,
  };
}

interface ApiPushedSharedGoal {
  id: string;
  source_goal_id: string;
  recipient_user_id: string;
  recipient_name: string;
  custom_weightage?: string | number | null;
  pushed_at: string;
  pushed_by_name: string;
  source_goal_title?: string | null;
  source_goal_description?: string | null;
  source_goal_thrust_area?: string | null;
  source_goal_uom_type?: string | null;
  source_goal_target_value?: string | number | null;
  source_goal_target_date?: string | null;
  source_goal_weightage?: string | number | null;
}

export interface PushedSharedGoal {
  id: string;
  sourceGoalId: string;
  recipientUserId: string;
  recipientName: string;
  customWeightage: number | null;
  pushedAt: string;
  pushedByName: string;
  sourceGoalTitle: string;
  sourceGoalDescription: string | null;
  sourceGoalThrustArea: ThrustArea | null;
  sourceGoalUomType: UoMType | null;
  sourceGoalTargetValue: number | null;
  sourceGoalTargetDate: string | null;
  sourceGoalWeightage: number;
}

function mapPushedSharedGoal(g: ApiPushedSharedGoal): PushedSharedGoal {
  const upperThrust = g.source_goal_thrust_area
    ? (g.source_goal_thrust_area.toUpperCase() as keyof typeof ThrustArea)
    : null;
  const upperUom = g.source_goal_uom_type
    ? (g.source_goal_uom_type.toUpperCase() as keyof typeof UoMType)
    : null;
  return {
    id: g.id,
    sourceGoalId: g.source_goal_id,
    recipientUserId: g.recipient_user_id,
    recipientName: g.recipient_name,
    customWeightage:
      g.custom_weightage === null || g.custom_weightage === undefined ? null : Number(g.custom_weightage),
    pushedAt: g.pushed_at,
    pushedByName: g.pushed_by_name,
    sourceGoalTitle: g.source_goal_title ?? "(untitled)",
    sourceGoalDescription: g.source_goal_description ?? null,
    sourceGoalThrustArea: upperThrust ? ThrustArea[upperThrust] ?? null : null,
    sourceGoalUomType: upperUom ? UoMType[upperUom] ?? null : null,
    sourceGoalTargetValue:
      g.source_goal_target_value === null || g.source_goal_target_value === undefined
        ? null
        : Number(g.source_goal_target_value),
    sourceGoalTargetDate: g.source_goal_target_date ?? null,
    sourceGoalWeightage: g.source_goal_weightage ? Number(g.source_goal_weightage) : 0,
  };
}

interface ApiAuditLog {
  id: string;
  table_name: string;
  record_id: string;
  action: string;
  field_name?: string | null;
  old_value?: string | null;
  new_value?: string | null;
  actor_id: string;
  actor_name: string;
  actor_role: string;
  changed_at: string;
}

interface ApiPaginationMeta {
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

function mapAuditLog(a: ApiAuditLog): AuditLog {
  return {
    id: a.id,
    tableName: a.table_name,
    recordId: a.record_id,
    action: a.action.toUpperCase() as AuditAction,
    fieldName: a.field_name ?? undefined,
    oldValue: a.old_value ?? undefined,
    newValue: a.new_value ?? undefined,
    actorId: a.actor_id,
    actorName: a.actor_name || "Unknown",
    actorRole: a.actor_role.toLowerCase() as UserRole,
    changedAt: a.changed_at,
  };
}

async function unwrap<T>(resp: APIResponse<T>): Promise<T> {
  if (!resp.success || resp.data === undefined || resp.data === null) {
    throw new Error(resp.error?.message ?? "Request failed");
  }
  return resp.data;
}

export interface CreateCycleInput {
  cycleName: string;
  phase: CyclePhase;
  windowOpen: string;
  windowClose: string;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OrgStats {
  totalUsers: number;
  totalGoals: number;
  goalsByStatus: Record<string, number>;
  totalSheets: number;
  sheetsByStatus: Record<string, number>;
  avgWeightage: number;
}

export interface AuditLogQuery {
  page?: number;
  pageSize?: number;
  actorId?: string;
  tableName?: string;
  action?: AuditAction;
  fromDate?: string;
  toDate?: string;
}

// ─── Service ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

export const adminService = {
  getCycleConfigs: async (): Promise<CycleConfig[]> => {
    const resp = await apiClient.get<APIResponse<CycleApi[]>>("/v1/admin/cycles");
    const data = await unwrap(resp);
    return data.map(mapCycle);
  },

  createCycleConfig: async (input: CreateCycleInput): Promise<CycleConfig> => {
    const resp = await apiClient.post<APIResponse<CycleApi>>("/v1/admin/cycles", {
      cycle_name: input.cycleName,
      phase: toApiPhase(input.phase),
      window_open: input.windowOpen,
      window_close: input.windowClose,
    });
    return mapCycle(await unwrap(resp));
  },

  updateCycleConfig: async (id: string, patch: Partial<CycleConfig>): Promise<CycleConfig> => {
    const body: Record<string, unknown> = {};
    if (patch.cycleName !== undefined) body.cycle_name = patch.cycleName;
    if (patch.phase !== undefined) body.phase = toApiPhase(patch.phase);
    if (patch.windowOpen !== undefined) body.window_open = patch.windowOpen;
    if (patch.windowClose !== undefined) body.window_close = patch.windowClose;
    const resp = await apiClient.patch<APIResponse<CycleApi>>(`/v1/admin/cycles/${id}`, body);
    return mapCycle(await unwrap(resp));
  },

  activateCycleWindow: async (
    cycleId: string,
    _windowOpen: string,
    _windowClose: string,
  ): Promise<CycleConfig> => {
    const resp = await apiClient.post<APIResponse<CycleApi>>(
      `/v1/admin/cycles/${cycleId}/activate`,
      {},
    );
    return mapCycle(await unwrap(resp));
  },

  pushSharedGoal: async (input: {
    goalData: {
      title: string;
      description?: string;
      thrustArea: ThrustArea;
      uomType: UoMType;
      targetValue: number | null;
      targetDate?: string;
      weightage: number;
    };
    recipientUserIds: string[];
    suggestedWeightage: number;
    cycleId?: string;
  }): Promise<Goal[]> => {
    const { goalData, recipientUserIds, suggestedWeightage, cycleId } = input;
    const goal_data: Record<string, unknown> = {
      title: goalData.title,
      description: goalData.description ?? null,
      thrust_area: String(goalData.thrustArea).toLowerCase(),
      uom_type: String(goalData.uomType).toLowerCase(),
      weightage: goalData.weightage,
    };
    if (goalData.uomType === UoMType.TIMELINE) {
      goal_data.target_value = null;
      goal_data.target_date = goalData.targetDate ?? null;
    } else if (goalData.uomType === UoMType.ZERO) {
      goal_data.target_value = 0;
      goal_data.target_date = null;
    } else {
      goal_data.target_value = goalData.targetValue;
      goal_data.target_date = null;
    }
    const url = cycleId
      ? `/v1/shared-goals/push?cycle_id=${encodeURIComponent(cycleId)}`
      : "/v1/shared-goals/push";
    const resp = await apiClient.post<APIResponse<ApiPushedGoal[]>>(url, {
      goal_data,
      recipient_user_ids: recipientUserIds,
      suggested_weightage: suggestedWeightage,
    });
    const data = await unwrap(resp);
    return data.map(mapPushedGoal);
  },

  listPushedSharedGoals: async (cycleId: string): Promise<PushedSharedGoal[]> => {
    const resp = await apiClient.get<APIResponse<ApiPushedSharedGoal[]>>(
      `/v1/shared-goals/pushed?cycle_id=${encodeURIComponent(cycleId)}`,
    );
    const data = await unwrap(resp);
    return data.map(mapPushedSharedGoal);
  },

  unlockGoal: (goalId: string) =>
    mockRequestOrThrow(() => {
      const idx = db.goals.findIndex((g) => g.id === goalId);
      if (idx === -1) throw new Error(`Goal ${goalId} not found`);
      const updated = {
        ...db.goals[idx],
        status: GoalStatus.APPROVED,
        lockedAt: undefined,
        lockedBy: undefined,
        updatedAt: now(),
      };
      db.goals[idx] = updated;
      return updated;
    }),

  unlockSheet: async (sheetId: string, reason: string): Promise<{ message: string }> => {
    const resp = await apiClient.post<APIResponse<{ message: string }>>(
      `/v1/admin/sheets/${sheetId}/unlock`,
      { reason }
    );
    if (!resp.success) {
      throw new Error(resp.error?.message ?? "Failed to unlock goal sheet");
    }
    return resp.data ?? { message: "Goal sheet unlocked" };
  },

  getAuditLog: async (query: AuditLogQuery = {}): Promise<PaginatedResponse<AuditLog>> => {
    const { page = 1, pageSize = 20, actorId, tableName, action, fromDate, toDate } = query;
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("page_size", String(pageSize));
    if (actorId) params.set("actor_id", actorId);
    if (tableName) params.set("table_name", tableName);
    if (action) params.set("action", action);
    if (fromDate) params.set("date_from", fromDate);
    if (toDate) params.set("date_to", toDate);

    const resp = await apiClient.get<APIResponse<{ items: ApiAuditLog[]; meta: ApiPaginationMeta }>>(
      `/v1/audit-logs/?${params.toString()}`
    );
    const data = await unwrap(resp);
    return {
      items: data.items.map(mapAuditLog),
      total: data.meta.total,
      page: data.meta.page,
      pageSize: data.meta.page_size,
      totalPages: data.meta.total_pages,
    };
  },

  getOrgStats: (): Promise<OrgStats> =>
    mockRequestOrThrow(() => {
      const goals = db.goals;
      const sheets = db.goalSheets;

      const goalsByStatus = goals.reduce<Record<string, number>>((acc, g) => {
        acc[g.status] = (acc[g.status] ?? 0) + 1;
        return acc;
      }, {});

      const sheetsByStatus = sheets.reduce<Record<string, number>>((acc, s) => {
        acc[s.status] = (acc[s.status] ?? 0) + 1;
        return acc;
      }, {});

      const totalWeightage = sheets.reduce((sum, s) => sum + s.totalWeightage, 0);
      const avgWeightage = sheets.length > 0 ? totalWeightage / sheets.length : 0;

      return {
        totalUsers: 5,
        totalGoals: goals.length,
        goalsByStatus,
        totalSheets: sheets.length,
        sheetsByStatus,
        avgWeightage,
      };
    }),
};
