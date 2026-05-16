import { CalendarCheck, ArrowRight, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { useTeamGoals } from "@/hooks/useGoals";
import { useDirectReports } from "@/hooks/useApprovals";
import { GoalStatus, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

// ─── Phase timeline ───────────────────────────────────────────────────────────

const PHASES = [
  { label: "Goal Setting", sub: "May 2026", done: true },
  { label: "Q1 Check-in", sub: "July 2026", done: false, current: true },
  { label: "Q2 Check-in", sub: "October 2026", done: false },
  { label: "Final Review", sub: "April 2027", done: false },
];

function PhaseTimeline() {
  return (
    <div className="flex items-center gap-0 overflow-x-auto pb-1">
      {PHASES.map((phase, i) => {
        const isLast = i === PHASES.length - 1;
        return (
          <div key={phase.label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5 min-w-[90px]">
              <div
                className={cn(
                  "h-7 w-7 rounded-full border-2 flex items-center justify-center text-xs font-bold",
                  phase.done && "border-emerald-500 bg-emerald-500 text-white",
                  phase.current && "border-indigo-500 bg-indigo-50 text-indigo-600 ring-2 ring-indigo-200",
                  !phase.done && !phase.current && "border-muted bg-muted/40 text-muted-foreground"
                )}
              >
                {phase.done ? "✓" : i + 1}
              </div>
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight",
                  phase.done && "text-emerald-600",
                  phase.current && "text-indigo-700 font-semibold",
                  !phase.done && !phase.current && "text-muted-foreground/60"
                )}
              >
                {phase.label}
              </span>
              <span className="text-[9px] text-muted-foreground/60">{phase.sub}</span>
            </div>
            {!isLast && (
              <div className="flex items-center pt-1 shrink-0 -mt-6">
                <ArrowRight
                  className={cn(
                    "h-3.5 w-3.5 mx-1",
                    phase.done ? "text-emerald-400" : "text-muted-foreground/30"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Greyed preview card ──────────────────────────────────────────────────────

function CheckinPreview() {
  return (
    <div className="rounded-lg border-2 border-dashed border-muted p-5 opacity-40 pointer-events-none select-none space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Q1 Achievement Entry</p>
        <Badge variant="outline" className="text-[10px]">Jul–Sep 2026</Badge>
      </div>
      <div className="space-y-2">
        {["Goal 1", "Goal 2", "Goal 3"].map((label) => (
          <div key={label} className="flex items-center gap-3 p-2 rounded border">
            <div className="flex-1">
              <p className="text-xs font-medium">{label}</p>
              <p className="text-[10px] text-muted-foreground">Target: 50 | Actual: ___</p>
            </div>
            <div className="w-16 h-5 rounded bg-muted" />
          </div>
        ))}
      </div>
      <div className="flex justify-end gap-2">
        <div className="h-7 w-20 rounded bg-muted" />
        <div className="h-7 w-24 rounded bg-indigo-200" />
      </div>
    </div>
  );
}

// ─── Approved goals preview ───────────────────────────────────────────────────

function ApprovedGoalRow({ goal }: Readonly<{ goal: Goal }>) {
  const uomMeta = UOM_TYPE_META[goal.uomType];
  let targetLabel = "";
  if (goal.uomType === UoMType.ZERO) targetLabel = "0 (Zero)";
  else if (goal.uomType === UoMType.TIMELINE) targetLabel = goal.targetDate ?? "—";
  else targetLabel = String(goal.targetValue ?? "—");

  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-muted/40 last:border-0">
      <Lock className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium truncate">{goal.title}</p>
        <p className="text-[10px] text-muted-foreground">
          {uomMeta?.label ?? goal.uomType} · Target: {targetLabel}
        </p>
      </div>
      <span className="text-[10px] font-semibold text-indigo-600 shrink-0">{goal.weightage}%</span>
      <GoalStatusBadge status={goal.status} size="sm" />
    </div>
  );
}

// ─── CheckinModule ────────────────────────────────────────────────────────────

export default function CheckinModule() {
  const { data: allGoals = [], isLoading: goalsLoading } = useTeamGoals(CYCLE_ID);
  const { data: directReports = [], isLoading: reportsLoading } = useDirectReports();

  const isLoading = goalsLoading || reportsLoading;
  const reportIds = directReports.map((u) => u.id);

  const approvedGoals = allGoals.filter(
    (g) =>
      reportIds.includes(g.userId) &&
      g.cycleId === CYCLE_ID &&
      (g.status === GoalStatus.APPROVED || g.status === GoalStatus.LOCKED)
  );

  // Group by employee
  const byEmployee = directReports.map((member) => ({
    member,
    goals: approvedGoals.filter((g) => g.userId === member.id),
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Check-in Module</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Quarterly achievement tracking for your team
        </p>
      </div>

      {/* Phase timeline */}
      <Card>
        <CardHeader className="pb-2 px-4 pt-4">
          <CardTitle className="text-sm font-semibold">FY 2026 Review Cycle</CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <PhaseTimeline />
        </CardContent>
      </Card>

      {/* Coming soon hero */}
      <Card className="border-2 border-dashed border-indigo-200 bg-indigo-50/20">
        <CardContent className="py-8 text-center space-y-4">
          <div className="flex h-16 w-16 mx-auto items-center justify-center rounded-full bg-indigo-100 text-indigo-500">
            <CalendarCheck className="h-8 w-8" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-indigo-800">Q1 Check-in Not Yet Open</h2>
            <p className="text-sm text-indigo-600/80 mt-1 max-w-md mx-auto">
              The Q1 achievement window opens in July 2026. You will be able to review your team&apos;s
              actuals against their approved targets and score their performance.
            </p>
          </div>
          <Badge className="bg-indigo-100 text-indigo-700 border border-indigo-200 font-medium">
            Available from July 2026
          </Badge>
        </CardContent>
      </Card>

      {/* Interface preview */}
      <div>
        <p className="text-xs font-medium text-muted-foreground mb-2">
          Preview: what the check-in interface will look like
        </p>
        <CheckinPreview />
      </div>

      {/* Approved goals preview by employee */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-foreground">
          Team Approved Goals{" "}
          <span className="text-xs font-normal text-muted-foreground">(read-only)</span>
        </h2>

        {isLoading ? (
          <div className="space-y-3">
            {["a", "b"].map((k) => <Skeleton key={k} className="h-28 w-full rounded-xl" />)}
          </div>
        ) : approvedGoals.length === 0 ? (
          <EmptyState
            variant="no-team-goals"
            title="No approved goals yet"
            description="Your team's approved goals will appear here once sheets are approved."
            className="py-8"
          />
        ) : (
          byEmployee.map(({ member, goals }) => {
            if (goals.length === 0) return null;
            return (
              <Card key={member.id}>
                <CardHeader className="pb-1 px-4 pt-3">
                  <div className="flex items-center gap-2">
                    <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-700 text-[10px] font-bold flex items-center justify-center">
                      {member.avatarInitials}
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{member.fullName}</p>
                      <p className="text-[10px] text-muted-foreground">{member.departmentName}</p>
                    </div>
                    <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1.5">
                      {goals.length} goals
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="px-4 pb-3">
                  {goals.map((goal) => (
                    <ApprovedGoalRow key={goal.id} goal={goal} />
                  ))}
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
}
