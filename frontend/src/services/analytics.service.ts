import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";

// ─── DTOs ─────────────────────────────────────────────────────────────────────

export interface QoQTrendPoint {
  quarter: string;
  avg_score: number | null;
  total_employees: number;
}

export interface HeatmapCell {
  department_id: string | null;
  department_name: string;
  quarter: string;
  total_employees: number;
  achievement_submitted_count: number;
  checkin_done_count: number;
  achievement_pct: number;
  checkin_pct: number;
}

export interface GoalDistribution {
  by_thrust_area: Array<{ label: string; count: number }>;
  by_uom_type: Array<{ label: string; count: number }>;
  by_status: Array<{ label: string; count: number }>;
}

export interface ManagerEffectivenessRow {
  manager_id: string;
  manager_name: string;
  direct_reports: number;
  avg_turnaround_days: number | null;
  avg_team_score: number | null;
  checkin_count: number;
  checkin_rate: number;
}

// ─── Service ──────────────────────────────────────────────────────────────────

export const analyticsService = {
  async getQoQTrend(params: {
    cycleId?: string;
    scope?: "org" | "department" | "manager" | "user";
    scopeId?: string;
  }): Promise<QoQTrendPoint[]> {
    const q = new URLSearchParams();
    if (params.scope) q.set("scope", params.scope);
    if (params.scopeId) q.set("scope_id", params.scopeId);
    if (params.cycleId) q.set("cycle_id", params.cycleId);
    const res = await apiClient.get<APIResponse<QoQTrendPoint[]>>(
      `/v1/reports/qoq-trend?${q.toString()}`
    );
    return res.data ?? [];
  },

  async getCompletionHeatmap(cycleId?: string): Promise<HeatmapCell[]> {
    const q = cycleId ? `?cycle_id=${cycleId}` : "";
    const res = await apiClient.get<APIResponse<HeatmapCell[]>>(
      `/v1/reports/completion-dashboard${q}`
    );
    return res.data ?? [];
  },

  async getGoalDistribution(cycleId?: string): Promise<GoalDistribution> {
    const q = cycleId ? `?cycle_id=${cycleId}` : "";
    const res = await apiClient.get<APIResponse<GoalDistribution>>(
      `/v1/reports/goal-distribution${q}`
    );
    return res.data ?? { by_thrust_area: [], by_uom_type: [], by_status: [] };
  },

  async getManagerEffectiveness(cycleId?: string): Promise<ManagerEffectivenessRow[]> {
    const q = cycleId ? `?cycle_id=${cycleId}` : "";
    const res = await apiClient.get<APIResponse<ManagerEffectivenessRow[]>>(
      `/v1/reports/manager-effectiveness${q}`
    );
    return res.data ?? [];
  },
};
