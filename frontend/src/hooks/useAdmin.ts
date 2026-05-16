import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import { goalService } from "@/services/goal.service";
import { useAuth } from "./useAuth";
import type { AuditLogQuery } from "@/services/admin.service";
import type { CycleConfig } from "@/types/cycle.types";
import type { ThrustArea, UoMType } from "@/types/goal.types";

// ─── Queries ──────────────────────────────────────────────────────────────────

export function useCycleConfigs() {
  return useQuery({
    queryKey: ["cycle-configs"],
    queryFn: () => adminService.getCycleConfigs(),
  });
}

export function useOrgStats() {
  return useQuery({
    queryKey: ["org-stats"],
    queryFn: () => adminService.getOrgStats(),
  });
}

export function useAdminAuditLog(query: AuditLogQuery = {}) {
  return useQuery({
    queryKey: ["audit-log", query],
    queryFn: () => adminService.getAuditLog(query),
  });
}

export function useAdminAllSheets(cycleId?: string) {
  return useQuery({
    queryKey: ["admin-all-sheets", cycleId],
    queryFn: () => goalService.getAllSheets(cycleId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useUpdateCycleConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<CycleConfig> }) =>
      adminService.updateCycleConfig(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-configs"] });
      toast.success("Cycle updated");
    },
    onError: () => toast.error("Failed to update cycle"),
  });
}

export function useActivateCycleWindow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      cycleId,
      windowOpen,
      windowClose,
    }: {
      cycleId: string;
      windowOpen: string;
      windowClose: string;
    }) => adminService.activateCycleWindow(cycleId, windowOpen, windowClose),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-configs"] });
      toast.success("Cycle window activated — all others deactivated");
    },
    onError: () => toast.error("Failed to activate cycle window"),
  });
}

export function useUnlockGoal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (goalId: string) => adminService.unlockGoal(goalId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-goals"] });
      toast.success("Goal unlocked — status set to Approved");
    },
    onError: () => toast.error("Failed to unlock goal"),
  });
}

// ─── Combined create-and-push mutation ───────────────────────────────────────

export interface KpiPayload {
  title: string;
  description?: string;
  thrustArea: ThrustArea;
  uomType: UoMType;
  targetValue: number | null;
  targetDate?: string;
  weightage: number;
}

export function usePushSharedGoal() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: async ({
      kpiData,
      targetUserIds,
      cycleId,
    }: {
      kpiData: KpiPayload;
      targetUserIds: string[];
      cycleId: string;
    }) => {
      const sourceGoal = await goalService.createGoal({
        ...kpiData,
        userId: currentUser?.id ?? "u-admin",
        cycleId,
      });
      return adminService.pushSharedGoal(sourceGoal.id, targetUserIds, cycleId);
    },
    onSuccess: (goals) => {
      qc.invalidateQueries({ queryKey: ["all-goals"] });
      toast.success(
        `Shared goal pushed to ${goals.length} employee${goals.length !== 1 ? "s" : ""}`
      );
    },
    onError: () => toast.error("Failed to push shared goal"),
  });
}
