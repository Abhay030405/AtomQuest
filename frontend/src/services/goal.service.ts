import { db } from "./_mockDB";
import { mockRequestOrThrow } from "./api.client";
import { GoalStatus } from "@/types/goal.types";
import type { Goal, GoalSheet, GoalVersion } from "@/types/goal.types";
import type { PaginatedResponse } from "@/types/api.types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function now() {
  return new Date().toISOString();
}

function getOrCreateSheet(userId: string, cycleId: string): GoalSheet {
  const existing = db.goalSheets.find(
    (s) => s.userId === userId && s.cycleId === cycleId
  );
  if (existing) return existing;
  const sheet: GoalSheet = {
    id: `gs-${userId}-${cycleId}`,
    userId,
    cycleId,
    status: GoalStatus.DRAFT,
    goals: [],
    totalWeightage: 0,
  };
  db.goalSheets.push(sheet);
  return sheet;
}

function syncSheetGoals(sheet: GoalSheet): void {
  sheet.goals = db.goals.filter(
    (g) => g.userId === sheet.userId && g.cycleId === sheet.cycleId
  );
  sheet.totalWeightage = sheet.goals.reduce((sum, g) => sum + g.weightage, 0);
}

// ─── Goal Service ─────────────────────────────────────────────────────────────

export const goalService = {
  getMyGoals: (userId: string, cycleId?: string) =>
    mockRequestOrThrow(() =>
      db.goals.filter(
        (g) => g.userId === userId && (!cycleId || g.cycleId === cycleId)
      )
    ),

  getMySheet: (userId: string, cycleId: string) =>
    mockRequestOrThrow(() => {
      const sheet = getOrCreateSheet(userId, cycleId);
      syncSheetGoals(sheet);
      return sheet;
    }),

  createGoal: (
    payload: Omit<Goal, "id" | "version" | "status" | "isShared" | "createdAt" | "updatedAt">
  ) =>
    mockRequestOrThrow(() => {
      const goal: Goal = {
        ...payload,
        id: crypto.randomUUID(),
        version: 1,
        status: GoalStatus.DRAFT,
        isShared: false,
        createdAt: now(),
        updatedAt: now(),
      };
      db.goals.push(goal);
      getOrCreateSheet(payload.userId, payload.cycleId);
      return goal;
    }),

  updateGoal: (id: string, patch: Partial<Goal>) =>
    mockRequestOrThrow(() => {
      const idx = db.goals.findIndex((g) => g.id === id);
      if (idx === -1) throw new Error(`Goal ${id} not found`);
      const updated = { ...db.goals[idx], ...patch, updatedAt: now() };
      db.goals[idx] = updated;
      return updated;
    }),

  deleteGoal: (id: string) =>
    mockRequestOrThrow(() => {
      const idx = db.goals.findIndex((g) => g.id === id);
      if (idx === -1) throw new Error(`Goal ${id} not found`);
      const [removed] = db.goals.splice(idx, 1);
      return removed;
    }),

  submitSheet: (userId: string, cycleId: string) =>
    mockRequestOrThrow(() => {
      const sheet = db.goalSheets.find(
        (s) => s.userId === userId && s.cycleId === cycleId
      );
      if (!sheet) throw new Error("Goal sheet not found");
      syncSheetGoals(sheet);
      if (sheet.totalWeightage !== 100)
        throw new Error(`Total weightage must be 100% (currently ${sheet.totalWeightage}%)`);
      sheet.status = GoalStatus.SUBMITTED;
      sheet.submittedAt = now();
      sheet.goals.forEach((g) => {
        const idx = db.goals.findIndex((dg) => dg.id === g.id);
        if (idx !== -1) db.goals[idx] = { ...db.goals[idx], status: GoalStatus.SUBMITTED, updatedAt: now() };
      });
      return sheet;
    }),

  getGoalVersions: (goalId: string): Promise<GoalVersion[]> =>
    mockRequestOrThrow(() =>
      db.goalVersions.filter((v) => v.goalId === goalId)
    ),

  getTeamGoals: (managerId: string, cycleId?: string) =>
    mockRequestOrThrow(() =>
      db.goals.filter((g) => {
        if (!cycleId || g.cycleId === cycleId) {
          return g.userId !== managerId;
        }
        return false;
      })
    ),

  getAllGoals: (cycleId?: string): Promise<Goal[]> =>
    mockRequestOrThrow(() =>
      db.goals.filter((g) => !cycleId || g.cycleId === cycleId)
    ),

  getPendingSheets: (): Promise<GoalSheet[]> =>
    mockRequestOrThrow(() =>
      db.goalSheets.filter((s) => s.status === GoalStatus.SUBMITTED)
    ),

  getGoalsByIds: (ids: string[]): Promise<Goal[]> =>
    mockRequestOrThrow(() => db.goals.filter((g) => ids.includes(g.id))),

  getAllSheets: (cycleId?: string): Promise<PaginatedResponse<GoalSheet>> =>
    mockRequestOrThrow(() => {
      const items = db.goalSheets.filter((s) => !cycleId || s.cycleId === cycleId);
      return { items, total: items.length, page: 1, pageSize: items.length, totalPages: 1 };
    }),
};
