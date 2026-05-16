import { GoalStatus, UoMType, ThrustArea } from "@/types/goal.types";
import { GOAL_STATUS_META } from "@/constants/goalStatus";
import { UOM_TYPE_META } from "@/constants/uomTypes";

export function formatWeightage(value: number): string {
  return `${value}%`;
}

export function formatStatus(status: GoalStatus): string {
  return GOAL_STATUS_META[status]?.label ?? status;
}

export function formatUoM(uomType: UoMType): string {
  return UOM_TYPE_META[uomType]?.label ?? uomType;
}

export function formatThrustArea(area: ThrustArea): string {
  return area
    .split("_")
    .map((w) => w[0] + w.slice(1).toLowerCase())
    .join(" ");
}

export function formatGoalCount(count: number): string {
  return `${count} goal${count === 1 ? "" : "s"}`;
}

export interface ScoreDisplay {
  value: number;
  label: string;
  colorClass: string;
}

export function formatScore(score: number): ScoreDisplay {
  const rounded = Math.round(score);
  let colorClass: string;
  if (rounded >= 80) colorClass = "text-score-high";
  else if (rounded >= 50) colorClass = "text-score-medium";
  else colorClass = "text-score-low";

  return { value: rounded, label: `${rounded}%`, colorClass };
}
