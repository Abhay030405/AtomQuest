import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { approvalService } from "@/services/approval.service";
import { goalService } from "@/services/goal.service";
import { userService } from "@/services/user.service";
import { useAuth } from "./useAuth";

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

export function useAllUsers() {
  return useQuery({
    queryKey: ["all-users"],
    queryFn: () => userService.getAllUsers(),
  });
}

export function useTeamSheets(cycleId: string) {
  return useQuery({
    queryKey: ["team-sheets", cycleId],
    queryFn: async () => (await goalService.getAllSheets(cycleId)).items,
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
      qc.invalidateQueries({ queryKey: ["team-goals"] });
      qc.invalidateQueries({ queryKey: ["all-goals"] });
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
      qc.invalidateQueries({ queryKey: ["team-goals"] });
      qc.invalidateQueries({ queryKey: ["all-goals"] });
    },
    onError: () => {
      toast.error("Failed to return sheet. Please try again.");
    },
  });
}

export function useInlineEditGoal() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: ({
      sheetId,
      goalId,
      patch,
    }: {
      sheetId: string;
      goalId: string;
      patch: {
        targetValue?: number | null;
        targetDate?: string | null;
        weightage?: number;
        changeReason: string;
      };
    }) => approvalService.inlineEditGoal(sheetId, goalId, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["sheet-review"] });
      qc.invalidateQueries({ queryKey: ["goal-versions"] });
      qc.invalidateQueries({ queryKey: ["team-goals"] });
      qc.invalidateQueries({ queryKey: ["all-goals"] });
    },
    onError: () => {
      toast.error("Failed to save change. Please try again.");
    },
  });
}
