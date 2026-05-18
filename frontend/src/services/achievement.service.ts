import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";

// ─── Enums (mirror backend) ───────────────────────────────────────────────────

export const Quarter = {
  Q1: "q1",
  Q2: "q2",
  Q3: "q3",
  Q4: "q4",
} as const;
export type Quarter = (typeof Quarter)[keyof typeof Quarter];

export const AchievementStatus = {
  NOT_STARTED: "not_started",
  ON_TRACK: "on_track",
  COMPLETED: "completed",
} as const;
export type AchievementStatus =
  (typeof AchievementStatus)[keyof typeof AchievementStatus];

export const ACHIEVEMENT_STATUS_LABEL: Record<AchievementStatus, string> = {
  not_started: "Not Started",
  on_track: "On Track",
  completed: "Completed",
};

// ─── Backend DTOs ─────────────────────────────────────────────────────────────

interface ApiScoreBreakdown {
  formula_used: string;
  target_value?: string | number | null;
  actual_value?: string | number | null;
  raw_ratio?: string | number | null;
  computed_score?: string | number | null;
  notes?: string | null;
}

interface ApiAchievement {
  id: string;
  goal_id: string;
  quarter: string;
  actual_value?: string | number | null;
  actual_date?: string | null;
  status: string;
  computed_score?: string | number | null;
  score_formula_used?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  is_synced_from_shared: boolean;
  created_at: string;
  updated_at?: string | null;
  goal_title?: string | null;
  owner_name?: string | null;
  score_breakdown?: ApiScoreBreakdown | null;
}

interface ApiQuarterGoal {
  goal: {
    id: string;
    title: string;
    uom_type: string;
    target_value?: string | null;
    target_date?: string | null;
    weightage: string;
    status: string;
  };
  achievement: ApiAchievement | null;
}

interface ApiQuarterView {
  quarter: string;
  cycle_id: string;
  window: {
    start: string;
    end: string;
    is_open: boolean;
  } | null;
  goals: ApiQuarterGoal[];
}

// ─── Frontend models ──────────────────────────────────────────────────────────

export interface QuarterGoalEntry {
  goalId: string;
  title: string;
  uomType: string;
  targetValue: number | null;
  targetDate: string | null;
  weightage: number;
  goalStatus: string;
  achievement: Achievement | null;
}

export interface QuarterView {
  quarter: Quarter;
  cycleId: string;
  window: { start: string; end: string; isOpen: boolean } | null;
  goals: QuarterGoalEntry[];
}

export interface Achievement {
  id: string;
  goalId: string;
  quarter: Quarter;
  actualValue: number | null;
  actualDate: string | null;
  status: AchievementStatus;
  computedScore: number | null;
  scoreFormulaUsed: string | null;
  submittedAt: string | null;
  submittedBy: string | null;
  goalTitle: string | null;
  ownerName: string | null;
}

// ─── Mappers ──────────────────────────────────────────────────────────────────

function toNum(v: string | number | null | undefined): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = typeof v === "string" ? Number(v) : v;
  return Number.isFinite(n) ? n : null;
}

function mapAchievement(a: ApiAchievement): Achievement {
  return {
    id: a.id,
    goalId: a.goal_id,
    quarter: a.quarter as Quarter,
    actualValue: toNum(a.actual_value ?? null),
    actualDate: a.actual_date ?? null,
    status: a.status as AchievementStatus,
    computedScore: toNum(a.computed_score ?? null),
    scoreFormulaUsed: a.score_formula_used ?? null,
    submittedAt: a.submitted_at ?? null,
    submittedBy: a.submitted_by ?? null,
    goalTitle: a.goal_title ?? null,
    ownerName: a.owner_name ?? null,
  };
}

function mapQuarterView(d: ApiQuarterView): QuarterView {
  return {
    quarter: d.quarter as Quarter,
    cycleId: d.cycle_id,
    window: d.window
      ? { start: d.window.start, end: d.window.end, isOpen: d.window.is_open }
      : null,
    goals: d.goals.map((g) => ({
      goalId: g.goal.id,
      title: g.goal.title,
      uomType: g.goal.uom_type,
      targetValue: toNum(g.goal.target_value ?? null),
      targetDate: g.goal.target_date ?? null,
      weightage: toNum(g.goal.weightage) ?? 0,
      goalStatus: g.goal.status,
      achievement: g.achievement ? mapAchievement(g.achievement) : null,
    })),
  };
}

// ─── Service ──────────────────────────────────────────────────────────────────

export interface AchievementInput {
  goalId: string;
  quarter: Quarter;
  actualValue: number | null;
  actualDate: string | null;
  status: AchievementStatus;
}

export interface AchievementResubmitInput {
  achievementId: string;
  actualValue: number | null;
  actualDate: string | null;
  status: AchievementStatus | null;
  editReason: string;
}

export const achievementService = {
  async getMyQuarter(quarter: Quarter, cycleId?: string): Promise<QuarterView> {
    const params = new URLSearchParams({ quarter });
    if (cycleId) params.set("cycle_id", cycleId);
    const res = await apiClient.get<APIResponse<ApiQuarterView>>(
      `/v1/achievements/my-quarter?${params.toString()}`
    );
    return mapQuarterView(res.data);
  },

  async bulkLog(items: AchievementInput[]): Promise<Achievement[]> {
    const payload = {
      achievements: items.map((i) => ({
        goal_id: i.goalId,
        quarter: i.quarter,
        actual_value: i.actualValue,
        actual_date: i.actualDate,
        status: i.status,
      })),
    };
    const res = await apiClient.post<APIResponse<ApiAchievement[]>>(
      "/v1/achievements/bulk",
      payload
    );
    return res.data.map(mapAchievement);
  },

  async resubmit(input: AchievementResubmitInput): Promise<Achievement> {
    const payload = {
      actual_value: input.actualValue,
      actual_date: input.actualDate,
      status: input.status,
      edit_reason: input.editReason,
    };
    const res = await apiClient.patch<APIResponse<ApiAchievement>>(
      `/v1/achievements/${input.achievementId}/resubmit`,
      payload
    );
    return mapAchievement(res.data);
  },
};
