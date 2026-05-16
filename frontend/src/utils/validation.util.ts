import type { Goal } from "@/types/goal.types";

const MAX_GOALS = 8;
const MIN_WEIGHTAGE_PER_GOAL = 10;
const VALID_TOTAL = 100;

export interface ValidationResult {
  field: string;
  message: string;
  severity: "error" | "warning";
}

export function validateWeightageSum(goals: Goal[]): ValidationResult[] {
  const total = goals.reduce((s, g) => s + g.weightage, 0);
  if (total === VALID_TOTAL) return [];
  return [
    {
      field: "weightage",
      message:
        total > VALID_TOTAL
          ? `Total weightage is ${total}% — must not exceed 100%`
          : `Total weightage is ${total}% — must reach exactly 100%`,
      severity: "error",
    },
  ];
}

export function validateGoalCount(goals: Goal[]): ValidationResult[] {
  if (goals.length === 0)
    return [{ field: "goals", message: "At least one goal is required.", severity: "error" }];
  if (goals.length > MAX_GOALS)
    return [
      {
        field: "goals",
        message: `Maximum ${MAX_GOALS} goals allowed (currently ${goals.length}).`,
        severity: "error",
      },
    ];
  return [];
}

export function validateMinWeightage(goals: Goal[]): ValidationResult[] {
  return goals
    .filter((g) => g.weightage < MIN_WEIGHTAGE_PER_GOAL)
    .map((g) => ({
      field: `goal.${g.id}.weightage`,
      message: `"${g.title}" has ${g.weightage}% weightage — minimum is ${MIN_WEIGHTAGE_PER_GOAL}%.`,
      severity: "warning" as const,
    }));
}

export function validateGoalSheet(goals: Goal[]): ValidationResult[] {
  return [
    ...validateGoalCount(goals),
    ...validateWeightageSum(goals),
    ...validateMinWeightage(goals),
  ];
}
