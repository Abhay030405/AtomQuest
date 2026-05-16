import { apiClient } from "./api-client";
import type { APIResponse } from "@/types/api.types";
import type { CycleConfig } from "@/types/cycle.types";
import { CyclePhase } from "@/types/cycle.types";

interface ActiveCycleApi {
  cycle_id: string | null;
  cycle_name: string | null;
  is_active: boolean;
  is_open: boolean;
  phase: string | null;
  days_remaining: number;
  window_open: string | null;
  window_close: string | null;
  message: string;
}

export interface ActiveCycleStatus {
  cycle: CycleConfig | null;
  isOpen: boolean;
  daysRemaining: number;
  message: string;
}

function phaseFromApi(value: string | null): CyclePhase {
  const up = (value ?? "GOAL_SETTING").toUpperCase();
  if (up in CyclePhase) return CyclePhase[up as keyof typeof CyclePhase];
  return CyclePhase.GOAL_SETTING;
}

export const cycleService = {
  getActive: async (): Promise<ActiveCycleStatus> => {
    const resp = await apiClient.get<APIResponse<ActiveCycleApi>>("/v1/admin/cycles/active");
    if (!resp.success || !resp.data) {
      throw new Error(resp.error?.message ?? "Failed to load active cycle");
    }
    const d = resp.data;
    const cycle: CycleConfig | null =
      d.cycle_id && d.window_open && d.window_close
        ? {
            id: d.cycle_id,
            cycleName: d.cycle_name ?? "",
            phase: phaseFromApi(d.phase),
            windowOpen: d.window_open,
            windowClose: d.window_close,
            isActive: d.is_active,
            createdBy: "",
          }
        : null;
    return {
      cycle,
      isOpen: d.is_open,
      daysRemaining: d.days_remaining,
      message: d.message,
    };
  },
};
