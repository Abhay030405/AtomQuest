import { cn } from "@/lib/utils";
import type { Goal } from "@/types/goal.types";

const MAX_GOALS = 8;
const VALID_TOTAL = 100;
const MIN_WEIGHTAGE = 10;

const PALETTE = [
  "#6366f1", "#10b981", "#f59e0b", "#3b82f6",
  "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6",
];

interface Props {
  goals: Goal[];
  showDetails?: boolean;
}

export function WeightageBar({ goals, showDetails = false }: Readonly<Props>) {
  const total = goals.reduce((s, g) => s + g.weightage, 0);
  const remaining = VALID_TOTAL - total;
  const isOver = total > VALID_TOTAL;
  const isExact = total === VALID_TOTAL;
  const isLow = total > 0 && total < 70;

  const barFill = Math.min(total, 100);

  let barColor = "bg-amber-500";
  if (isOver || isLow) barColor = "bg-red-500";
  else if (isExact) barColor = "bg-emerald-500";

  let allocatedColor = "text-amber-600";
  if (isOver) allocatedColor = "text-red-600";
  else if (isExact) allocatedColor = "text-emerald-600";

  const underweightGoals = goals.filter((g) => g.weightage < MIN_WEIGHTAGE);

  const warnings: string[] = [];
  if (isOver) warnings.push(`${Math.abs(remaining)}% over limit`);
  if (underweightGoals.length > 0)
    warnings.push(`${underweightGoals.length} goal(s) below ${MIN_WEIGHTAGE}% minimum`);
  if (!isOver && goals.length === MAX_GOALS && !isExact)
    warnings.push("Max goals reached — must total 100%");

  return (
    <div className="space-y-2">
      {/* Labels above bar */}
      <div className="flex items-center justify-between text-xs font-medium">
        <span className={allocatedColor}>{total}% allocated</span>
        <span className="text-muted-foreground">
          {isOver
            ? `${Math.abs(remaining)}% over limit`
            : `${remaining}% remaining`}
        </span>
      </div>

      {/* Bar */}
      {showDetails && goals.length > 0 ? (
        <div className="h-3 rounded-full overflow-hidden bg-muted flex">
          {goals.map((g, i) => (
            <div
              key={g.id}
              title={`${g.title}: ${g.weightage}%`}
              className="h-full transition-all"
              style={{
                width: `${g.weightage}%`,
                backgroundColor: PALETTE[i % PALETTE.length],
              }}
            />
          ))}
        </div>
      ) : (
        <div className="h-3 rounded-full overflow-hidden bg-muted">
          <div
            className={cn("h-full rounded-full transition-all duration-300", barColor)}
            style={{ width: `${barFill}%` }}
          />
        </div>
      )}

      {/* Footer row */}
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span>
          {goals.length} / {MAX_GOALS} goals added
        </span>
        {warnings.length > 0 && (
          <>
            <span className="text-muted-foreground/40">·</span>
            <span className="text-amber-600 font-medium">{warnings[0]}</span>
          </>
        )}
      </div>

      {/* Detailed stacked legend */}
      {showDetails && goals.length > 0 && (
        <div className="mt-3 space-y-1.5 pt-2 border-t">
          {goals.map((g, i) => (
            <div key={g.id} className="flex items-center gap-2 text-xs">
              <span
                className="h-2.5 w-2.5 rounded-sm shrink-0"
                style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
              />
              <span className="flex-1 truncate text-foreground">{g.title}</span>
              <span className="font-semibold tabular-nums text-right w-8">
                {g.weightage}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
