import { db } from "./_mockDB";
import { mockRequestOrThrow } from "./api.client";
import { GoalStatus } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";

function now() {
  return new Date().toISOString();
}

export const approvalService = {
  getPendingApprovals: () =>
    mockRequestOrThrow(() =>
      db.goalSheets.filter((s) => s.status === GoalStatus.SUBMITTED)
    ),

  getSheetForReview: (sheetId: string) =>
    mockRequestOrThrow(() => {
      const sheet = db.goalSheets.find((s) => s.id === sheetId);
      if (!sheet) throw new Error(`Sheet ${sheetId} not found`);
      sheet.goals = db.goals.filter(
        (g) => g.userId === sheet.userId && g.cycleId === sheet.cycleId
      );
      return sheet;
    }),

  approveSheet: (sheetId: string, _approverId: string) =>
    mockRequestOrThrow(() => {
      const sheet = db.goalSheets.find((s) => s.id === sheetId);
      if (!sheet) throw new Error(`Sheet ${sheetId} not found`);
      if (sheet.status !== GoalStatus.SUBMITTED)
        throw new Error("Only submitted sheets can be approved");
      sheet.status = GoalStatus.APPROVED;
      sheet.approvedAt = now();
      sheet.goals.forEach((g) => {
        const idx = db.goals.findIndex((dg) => dg.id === g.id);
        if (idx !== -1) {
          db.goals[idx] = {
            ...db.goals[idx],
            status: GoalStatus.APPROVED,
            updatedAt: now(),
          };
        }
      });
      return sheet;
    }),

  returnForRework: (sheetId: string, reason: string) =>
    mockRequestOrThrow(() => {
      const sheet = db.goalSheets.find((s) => s.id === sheetId);
      if (!sheet) throw new Error(`Sheet ${sheetId} not found`);
      if (sheet.status !== GoalStatus.SUBMITTED)
        throw new Error("Only submitted sheets can be returned");
      sheet.status = GoalStatus.DRAFT;
      sheet.goals.forEach((g) => {
        const idx = db.goals.findIndex((dg) => dg.id === g.id);
        if (idx !== -1) {
          db.goals[idx] = {
            ...db.goals[idx],
            status: GoalStatus.DRAFT,
            updatedAt: now(),
          };
        }
      });
      return { sheet, reason };
    }),

  inlineEditGoal: (goalId: string, patch: Partial<Goal>) =>
    mockRequestOrThrow(() => {
      const idx = db.goals.findIndex((g) => g.id === goalId);
      if (idx === -1) throw new Error(`Goal ${goalId} not found`);
      const goal = db.goals[idx];
      if (goal.status !== GoalStatus.SUBMITTED && goal.status !== GoalStatus.UNDER_REVIEW)
        throw new Error("Only submitted or under-review goals can be inline-edited");
      const updated: Goal = { ...goal, ...patch, status: GoalStatus.UNDER_REVIEW, updatedAt: now() };
      db.goals[idx] = updated;
      return updated;
    }),
};
