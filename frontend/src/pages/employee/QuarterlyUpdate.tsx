import { CalendarDays, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { Skeleton } from "@/components/ui/skeleton";
import { useMyGoals } from "@/hooks/useGoals";
import { GoalStatus, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { formatThrustArea } from "@/utils/format.util";
import { UOM_TYPE_META } from "@/constants/uomTypes";

const CYCLE_ID = "cycle-fy2026";

// ─── Target display helper ────────────────────────────────────────────────────

function TargetCell({ goal }: Readonly<{ goal: Goal }>) {
  if (goal.uomType === UoMType.TIMELINE) {
    return <span>{goal.targetDate ?? "—"}</span>;
  }
  if (goal.uomType === UoMType.ZERO) {
    return <span>Zero Incidents</span>;
  }
  const meta = UOM_TYPE_META[goal.uomType];
  return (
    <span>
      {goal.targetValue ?? "—"}
      {meta && (
        <span className="text-muted-foreground ml-1 text-[10px]">({meta.label})</span>
      )}
    </span>
  );
}

// ─── Locked goals table ───────────────────────────────────────────────────────

function LockedGoalsTable({ goals }: Readonly<{ goals: Goal[] }>) {
  const lockedGoals = goals.filter(
    (g) => g.status === GoalStatus.APPROVED || g.status === GoalStatus.LOCKED
  );

  if (lockedGoals.length === 0) {
    return (
      <EmptyState
        variant="no-goals"
        title="No approved goals yet"
        description="Your approved goals will appear here once your manager has reviewed your sheet."
        className="py-10"
      />
    );
  }

  return (
    <div className="border rounded-lg overflow-hidden">
      <table className="w-full text-xs">
        <thead className="bg-muted/40 border-b">
          <tr>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground">Goal</th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">
              Area
            </th>
            <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">
              Target
            </th>
            <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground w-12">Wt.</th>
            <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {lockedGoals.map((goal) => (
            <tr key={goal.id} className="border-b border-muted/40 last:border-0">
              <td className="px-3 py-2.5 font-medium max-w-[160px] truncate">{goal.title}</td>
              <td className="px-3 py-2.5 text-muted-foreground hidden sm:table-cell">
                {formatThrustArea(goal.thrustArea)}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground hidden md:table-cell">
                <TargetCell goal={goal} />
              </td>
              <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                {goal.weightage}%
              </td>
              <td className="px-3 py-2.5 text-right">
                <GoalStatusBadge status={goal.status} size="sm" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ─── QuarterlyUpdate ──────────────────────────────────────────────────────────

export default function QuarterlyUpdate() {
  const { data: goals = [], isLoading } = useMyGoals(CYCLE_ID);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Quarterly Update</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Track your achievements against your approved goals
        </p>
      </div>

      {/* Coming soon hero */}
      <Card className="border-dashed border-2 border-indigo-200 bg-indigo-50/30">
        <CardContent className="py-12 flex flex-col items-center text-center gap-4">
          {/* Illustration area */}
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
            <CalendarDays className="h-10 w-10" />
          </div>

          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-indigo-800">
              Q1 Achievement Tracking
            </h2>
            <p className="text-sm text-indigo-600/80 max-w-sm">
              Quarterly achievement tracking opens in July 2026, after the goal-setting window
              closes and goals are approved.
            </p>
          </div>

          <Badge className="bg-indigo-100 text-indigo-700 border-indigo-200 border font-medium">
            Opens July 2026
          </Badge>

          {/* Reminder note */}
          <div className="flex items-center gap-2 text-xs text-indigo-600/70 mt-2">
            <Bell className="h-3.5 w-3.5" />
            <span>You&apos;ll receive an email notification when the Q1 window opens.</span>
          </div>
        </CardContent>
      </Card>

      {/* Locked goals preview */}
      <Card>
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-semibold">
            Your Approved Goals{" "}
            <span className="text-xs font-normal text-muted-foreground ml-1">
              (read-only preview)
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {isLoading ? (
            <div className="space-y-2">
              {["a", "b", "c"].map((k) => (
                <Skeleton key={k} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <LockedGoalsTable goals={goals} />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
