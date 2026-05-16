import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { approvalService } from "@/services/approval.service";
import { goalService } from "@/services/goal.service";
import { userService } from "@/services/user.service";
import { useAuth } from "./useAuth";
import type { Goal } from "@/types/goal.types";

export function useSheetForReview(sheetId: string) {
  return useQuery({
    queryKey: ["sheet-review", sheetId],
    queryFn: () => approvalService.getSheetForReview(sheetId),
    enabled: Boolean(sheetId),
  });
}

export function useDirectReports() {
  const { currentUser } = useAuth();
  const managerId = currentUser?.id ?? "";

  return useQuery({
    queryKey: ["direct-reports", managerId],
    queryFn: () => userService.getDirectReports(managerId),
    enabled: Boolean(managerId),
  });
}

export function useTeamSheets(cycleId: string) {
  return useQuery({
    queryKey: ["team-sheets", cycleId],
    queryFn: () => goalService.getAllSheets(cycleId),
    enabled: Boolean(cycleId),
  });
}

export function useApproveSheet() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: (sheetId: string) =>
      approvalService.approveSheet(sheetId, currentUser?.id ?? ""),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["sheet-review"] });
      qc.invalidateQueries({ queryKey: ["team-sheets"] });
    },
    onError: () => {
      toast.error("Failed to approve sheet. Please try again.");
    },
  });
}

export function useReturnForRework() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ sheetId, reason }: { sheetId: string; reason: string }) =>
      approvalService.returnForRework(sheetId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      qc.invalidateQueries({ queryKey: ["sheet-review"] });
      qc.invalidateQueries({ queryKey: ["team-sheets"] });
    },
    onError: () => {
      toast.error("Failed to return sheet. Please try again.");
    },
  });
}

export function useInlineEditGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({ goalId, patch }: { goalId: string; patch: Partial<Goal> }) =>
      approvalService.inlineEditGoal(goalId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheet-review"] });
      qc.invalidateQueries({ queryKey: ["goal-versions"] });
    },
    onError: () => {
      toast.error("Failed to save change. Please try again.");
    },
  });
}
