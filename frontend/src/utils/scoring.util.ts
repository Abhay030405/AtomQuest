import { UoMType } from "@/types/goal.types";

export interface ScoreResult {
  score: number;
  level: "high" | "medium" | "low";
  label: string;
}

// ─── Individual scorers ───────────────────────────────────────────────────────

/** Higher is better: (actual / target) × 100, capped at 100 */
export function computeMinScore(actual: number, target: number): number {
  if (target === 0) return 0;
  return Math.min(100, (actual / target) * 100);
}

/** Lower is better: (target / actual) × 100, capped at 100 */
export function computeMaxScore(actual: number, target: number): number {
  if (actual === 0) return 100;
  return Math.min(100, (target / actual) * 100);
}

/** Date-based: 100 if completed by targetDate, otherwise 0 */
export function computeTimelineScore(completedDate: string | null, targetDate: string): number {
  if (!completedDate) return 0;
  return completedDate <= targetDate ? 100 : 0;
}

/** Zero = success: 100 if actual === 0, else 0 */
export function computeZeroScore(actual: number): number {
  return actual === 0 ? 100 : 0;
}

// ─── Dispatcher ───────────────────────────────────────────────────────────────

function scoreLevel(score: number): "high" | "medium" | "low" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export interface ComputeScoreInput {
  uomType: UoMType;
  actual: number;
  target: number | null;
  targetDate?: string;
  completedDate?: string | null;
}

export function computeScore(input: ComputeScoreInput): ScoreResult {
  const { uomType, actual, target, targetDate, completedDate } = input;
  let score = 0;

  switch (uomType) {
    case UoMType.MIN:
      score = computeMinScore(actual, target ?? 0);
      break;
    case UoMType.MAX:
      score = computeMaxScore(actual, target ?? 0);
      break;
    case UoMType.TIMELINE:
      score = computeTimelineScore(completedDate ?? null, targetDate ?? "");
      break;
    case UoMType.ZERO:
      score = computeZeroScore(actual);
      break;
  }

  const level = scoreLevel(score);
  return { score, level, label: `${Math.round(score)}%` };
}
