import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";
import type {
  EscalationLog,
  EscalationRule,
  EscalationRuleCreate,
  EscalationRuleUpdate,
  EscalationRunResult,
} from "@/types/escalation.types";

const BASE = "/v1/escalations";

export const escalationService = {
  // ── Rules ──────────────────────────────────────────────────────────────────

  async getRules(skip = 0, limit = 100): Promise<EscalationRule[]> {
    const res = await apiClient.get<APIResponse<EscalationRule[]>>(
      `${BASE}/rules?skip=${skip}&limit=${limit}`,
    );
    return res.data ?? [];
  },

  async getRule(id: string): Promise<EscalationRule> {
    const res = await apiClient.get<APIResponse<EscalationRule>>(
      `${BASE}/rules/${id}`,
    );
    return res.data;
  },

  async createRule(payload: EscalationRuleCreate): Promise<EscalationRule> {
    const res = await apiClient.post<APIResponse<EscalationRule>>(
      `${BASE}/rules`,
      payload,
    );
    return res.data;
  },

  async updateRule(id: string, patch: EscalationRuleUpdate): Promise<EscalationRule> {
    const res = await apiClient.patch<APIResponse<EscalationRule>>(
      `${BASE}/rules/${id}`,
      patch,
    );
    return res.data;
  },

  async deleteRule(id: string): Promise<void> {
    await apiClient.delete(`${BASE}/rules/${id}`);
  },

  // ── Logs ───────────────────────────────────────────────────────────────────

  async getLogs(params?: {
    rule_id?: string;
    subject_user_id?: string;
    status?: "open" | "resolved";
    skip?: number;
    limit?: number;
  }): Promise<EscalationLog[]> {
    const qs = new URLSearchParams();
    if (params?.rule_id) qs.set("rule_id", params.rule_id);
    if (params?.subject_user_id) qs.set("subject_user_id", params.subject_user_id);
    if (params?.status) qs.set("status", params.status);
    if (params?.skip != null) qs.set("skip", String(params.skip));
    if (params?.limit != null) qs.set("limit", String(params.limit));
    const query = qs.toString() ? `?${qs.toString()}` : "";
    const res = await apiClient.get<APIResponse<EscalationLog[]>>(
      `${BASE}/logs${query}`,
    );
    return res.data ?? [];
  },

  // ── Engine ─────────────────────────────────────────────────────────────────

  async runNow(): Promise<EscalationRunResult> {
    const res = await apiClient.post<APIResponse<EscalationRunResult>>(
      `${BASE}/run-now`,
      {},
    );
    return res.data;
  },
};
