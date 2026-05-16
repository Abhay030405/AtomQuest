import type { Goal } from "@/types/goal.types";

const MAX_GOALS = 8;
const MIN_WEIGHTAGE_PER_GOAL = 10;
const VALID_TOTAL = 100;

export interface WeightageState {
  totalWeightage: number;
  remainingWeightage: number;
  isValid: boolean;
  isOverAllocated: boolean;
  isUnderAllocated: boolean;
  goalCount: number;
  canAddMore: boolean;
  underweightGoals: string[];
}

export function useWeightage(goals: Goal[]): WeightageState {
  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  const remainingWeightage = VALID_TOTAL - totalWeightage;
  const goalCount = goals.length;
  const isOverAllocated = totalWeightage > VALID_TOTAL;
  const isUnderAllocated = totalWeightage < VALID_TOTAL;
  const isValid = totalWeightage === VALID_TOTAL && goalCount > 0;
  const canAddMore = goalCount < MAX_GOALS;

  const underweightGoals = goals
    .filter((g) => g.weightage < MIN_WEIGHTAGE_PER_GOAL)
    .map((g) => g.id);

  return {
    totalWeightage,
    remainingWeightage,
    isValid,
    isOverAllocated,
    isUnderAllocated,
    goalCount,
    canAddMore,
    underweightGoals,
  };
}
