import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { adminService } from "@/services/admin.service";
import { goalService } from "@/services/goal.service";
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
    queryKey: ["admin-all-sheets", cycleId ?? ""],
    queryFn: () => goalService.getAllSheets(cycleId),
    enabled: Boolean(cycleId),
  });
}

export function useAdminPushedSharedGoals(cycleId?: string) {
  return useQuery({
    queryKey: ["admin-pushed-shared-goals", cycleId],
    queryFn: () => adminService.listPushedSharedGoals(cycleId as string),
    enabled: Boolean(cycleId),
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

export function useCreateCycleConfig() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: Parameters<typeof adminService.createCycleConfig>[0]) =>
      adminService.createCycleConfig(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["cycle-configs"] });
      toast.success("Cycle created");
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to create cycle";
      toast.error(msg);
    },
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

export function useUnlockSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ sheetId, reason }: { sheetId: string; reason: string }) =>
      adminService.unlockSheet(sheetId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["all-goals"] });
      qc.invalidateQueries({ queryKey: ["admin-all-sheets"] });
      qc.invalidateQueries({ queryKey: ["team-goals"] });
      qc.invalidateQueries({ queryKey: ["team-sheets"] });
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["sheet-review"] });
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to unlock goal sheet";
      toast.error(msg);
    },
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

  return useMutation({
    mutationFn: ({
      kpiData,
      targetUserIds,
      cycleId,
    }: {
      kpiData: KpiPayload;
      targetUserIds: string[];
      cycleId?: string;
    }) =>
      adminService.pushSharedGoal({
        goalData: kpiData,
        recipientUserIds: targetUserIds,
        suggestedWeightage: kpiData.weightage,
        cycleId,
      }),
    onSuccess: (goals) => {
      qc.invalidateQueries({ queryKey: ["all-goals"] });
      qc.invalidateQueries({ queryKey: ["admin-pushed-shared-goals"] });
      const n = goals.length;
      toast.success(`Shared goal pushed to ${n} employee${n === 1 ? "" : "s"}`);
    },
    onError: (e: unknown) => {
      const msg = e instanceof Error ? e.message : "Failed to push shared goal";
      toast.error(msg);
    },
  });
}
