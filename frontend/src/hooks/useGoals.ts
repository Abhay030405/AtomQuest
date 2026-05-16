import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { goalService } from "@/services/goal.service";
import { approvalService } from "@/services/approval.service";
import type { Goal } from "@/types/goal.types";
import { useAuth } from "./useAuth";

// ─── Employee / own goals ──────────────────────────────────────────────────────

export function useMyGoals(cycleId?: string) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? "";

  return useQuery({
    queryKey: ["my-goals", userId, cycleId],
    queryFn: () => goalService.getMyGoals(userId, cycleId),
    enabled: Boolean(userId && cycleId),
  });
}

export function useMySheet(cycleId: string) {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? "";

  return useQuery({
    queryKey: ["my-sheet", userId, cycleId],
    queryFn: () => goalService.getMySheet(userId, cycleId),
    enabled: Boolean(userId && cycleId),
  });
}

export function useGoalVersions(goalId: string) {
  return useQuery({
    queryKey: ["goal-versions", goalId],
    queryFn: () => goalService.getGoalVersions(goalId),
    enabled: Boolean(goalId),
  });
}

// ─── Mutations ────────────────────────────────────────────────────────────────

export function useCreateGoal() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: (payload: Omit<Goal, "id" | "version" | "status" | "isShared" | "createdAt" | "updatedAt">) =>
      goalService.createGoal(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-goals", currentUser?.id] });
      qc.invalidateQueries({ queryKey: ["my-sheet", currentUser?.id] });
    },
  });
}

export function useUpdateGoal() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Goal> }) =>
      goalService.updateGoal(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-goals", currentUser?.id] });
      qc.invalidateQueries({ queryKey: ["my-sheet", currentUser?.id] });
      qc.invalidateQueries({ queryKey: ["team-goals"] });
    },
  });
}

export function useDeleteGoal() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();

  return useMutation({
    mutationFn: (id: string) => goalService.deleteGoal(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-goals", currentUser?.id] });
      qc.invalidateQueries({ queryKey: ["my-sheet", currentUser?.id] });
    },
  });
}

export function useSubmitSheet(cycleId: string) {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? "";

  return useMutation({
    mutationFn: () => goalService.submitSheet(userId, cycleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-sheet", userId, cycleId] });
      qc.invalidateQueries({ queryKey: ["my-goals", userId] });
    },
  });
}

// ─── Manager ──────────────────────────────────────────────────────────────────

export function usePendingApprovals() {
  return useQuery({
    queryKey: ["pending-approvals"],
    queryFn: () => approvalService.getPendingApprovals(),
  });
}

export function useTeamGoals(cycleId?: string) {
  const { currentUser } = useAuth();

  return useQuery({
    queryKey: ["team-goals", currentUser?.id, cycleId],
    queryFn: () => goalService.getTeamGoals(currentUser?.id ?? "", cycleId),
    enabled: Boolean(currentUser?.id),
  });
}

// ─── Admin ────────────────────────────────────────────────────────────────────

export function useAllGoals(cycleId?: string) {
  return useQuery({
    queryKey: ["all-goals", cycleId],
    queryFn: () => goalService.getAllGoals(cycleId),
  });
}
