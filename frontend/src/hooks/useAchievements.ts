import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  achievementService,
  type AchievementInput,
  type AchievementResubmitInput,
  type Quarter,
} from "@/services/achievement.service";

const QK = {
  myQuarter: (quarter: Quarter, cycleId?: string) =>
    ["achievements", "my-quarter", quarter, cycleId ?? "active"] as const,
};

export function useMyQuarter(quarter: Quarter, cycleId?: string) {
  return useQuery({
    queryKey: QK.myQuarter(quarter, cycleId),
    queryFn: () => achievementService.getMyQuarter(quarter, cycleId),
    enabled: Boolean(quarter),
  });
}

export function useBulkLogAchievements(quarter: Quarter, cycleId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (items: AchievementInput[]) => achievementService.bulkLog(items),
    onSuccess: (results) => {
      toast.success(
        `Submitted ${results.length} update${results.length === 1 ? "" : "s"} for review`
      );
      qc.invalidateQueries({ queryKey: QK.myQuarter(quarter, cycleId) });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit updates");
    },
  });
}

export function useResubmitAchievement(quarter: Quarter, cycleId?: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AchievementResubmitInput) =>
      achievementService.resubmit(input),
    onSuccess: () => {
      toast.success("Update saved");
      qc.invalidateQueries({ queryKey: QK.myQuarter(quarter, cycleId) });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to save update");
    },
  });
}
