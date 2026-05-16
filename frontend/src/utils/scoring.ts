export type ScoreLevel = "high" | "medium" | "low";

export function getScoreLevel(percent: number): ScoreLevel {
  if (percent >= 80) return "high";
  if (percent >= 50) return "medium";
  return "low";
}

export function calcCompletionPercent(current: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(Math.round((current / target) * 100), 100);
}
