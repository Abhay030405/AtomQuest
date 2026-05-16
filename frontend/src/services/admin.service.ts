import { db } from "./_mockDB";
import { mockRequestOrThrow } from "./api.client";
import { GoalStatus } from "@/types/goal.types";
import type { CycleConfig } from "@/types/cycle.types";
import type { AuditLog } from "@/types/audit.types";
import type { AuditAction } from "@/types/audit.types";
import type { Goal } from "@/types/goal.types";
import type { PaginatedResponse } from "@/types/api.types";

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
  getCycleConfigs: () =>
    mockRequestOrThrow(() => [...db.cycleConfigs]),

  updateCycleConfig: (id: string, patch: Partial<CycleConfig>) =>
    mockRequestOrThrow(() => {
      const idx = db.cycleConfigs.findIndex((c) => c.id === id);
      if (idx === -1) throw new Error(`Cycle ${id} not found`);
      db.cycleConfigs[idx] = { ...db.cycleConfigs[idx], ...patch };
      return db.cycleConfigs[idx];
    }),

  activateCycleWindow: (cycleId: string, windowOpen: string, windowClose: string) =>
    mockRequestOrThrow(() => {
      db.cycleConfigs.forEach((c) => { c.isActive = false; });
      const idx = db.cycleConfigs.findIndex((c) => c.id === cycleId);
      if (idx === -1) throw new Error(`Cycle ${cycleId} not found`);
      db.cycleConfigs[idx] = {
        ...db.cycleConfigs[idx],
        isActive: true,
        windowOpen,
        windowClose,
      };
      return db.cycleConfigs[idx];
    }),

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
