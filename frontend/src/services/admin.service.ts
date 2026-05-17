import { db } from "./_mockDB";
import { mockRequestOrThrow } from "./api.client";
import { apiClient } from "./api-client";
import { GoalStatus } from "@/types/goal.types";
import type { APIResponse, PaginatedResponse } from "@/types/api.types";
import type { CycleConfig, CyclePhase } from "@/types/cycle.types";
import type { AuditLog, AuditAction } from "@/types/audit.types";
import type { Goal } from "@/types/goal.types";

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

function mapCycle(c: CycleApi): CycleConfig {
  return {
    id: c.id,
    cycleName: c.cycle_name,
    phase: c.phase as CyclePhase,
    windowOpen: c.window_open,
    windowClose: c.window_close,
    isActive: c.is_active,
    createdBy: c.created_by ?? "",
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
      phase: input.phase,
      window_open: input.windowOpen,
      window_close: input.windowClose,
    });
    return mapCycle(await unwrap(resp));
  },

  updateCycleConfig: async (id: string, patch: Partial<CycleConfig>): Promise<CycleConfig> => {
    const body: Record<string, unknown> = {};
    if (patch.cycleName !== undefined) body.cycle_name = patch.cycleName;
    if (patch.phase !== undefined) body.phase = patch.phase;
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

  pushSharedGoal: (sourceGoalId: string, targetUserIds: string[], cycleId: string) =>
    mockRequestOrThrow(() => {
      const source = db.goals.find((g) => g.id === sourceGoalId);
      if (!source) throw new Error(`Goal ${sourceGoalId} not found`);
      const pushed: Goal[] = targetUserIds.map((userId) => ({
        ...source,
        id: crypto.randomUUID(),
        userId,
        cycleId,
        isShared: true,
        sourceSharedGoalId: sourceGoalId,
        status: GoalStatus.DRAFT,
        version: 1,
        createdAt: now(),
        updatedAt: now(),
      }));
      db.goals.push(...pushed);
      return pushed;
    }),

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

  getAuditLog: (query: AuditLogQuery = {}): Promise<PaginatedResponse<AuditLog>> =>
    mockRequestOrThrow(() => {
      const { page = 1, pageSize = 20, actorId, tableName, action, fromDate, toDate } = query;
      let logs = [...db.auditLogs];

      if (actorId) logs = logs.filter((l) => l.actorId === actorId);
      if (tableName) logs = logs.filter((l) => l.tableName === tableName);
      if (action) logs = logs.filter((l) => l.action === action);
      if (fromDate) logs = logs.filter((l) => l.changedAt >= fromDate);
      if (toDate) logs = logs.filter((l) => l.changedAt <= toDate);

      logs.sort((a, b) => b.changedAt.localeCompare(a.changedAt));

      const total = logs.length;
      const totalPages = Math.max(1, Math.ceil(total / pageSize));
      const items = logs.slice((page - 1) * pageSize, page * pageSize);

      return { items, total, page, pageSize, totalPages };
    }),

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
