import { Link } from "react-router-dom";
import {
  Target,
  Clock,
  CheckCircle,
  TrendingUp,
  ChevronRight,
  Plus,
  Send,
  Eye,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { useMyGoals, useMySheet } from "@/hooks/useGoals";
import { useWeightage } from "@/hooks/useWeightage";
import { useWindowStatus } from "@/hooks/useWindowStatus";
import { useAuth } from "@/hooks/useAuth";
import { GoalStatus } from "@/types/goal.types";
import type { Goal, GoalSheetStatus } from "@/types/goal.types";
import { CyclePhase } from "@/types/cycle.types";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

// ─── Metric Card ──────────────────────────────────────────────────────────────

interface MetricCardProps {
  readonly icon: React.ElementType;
  readonly label: string;
  readonly children: React.ReactNode;
  readonly iconColor?: string;
}

function MetricCard({ icon: Icon, label, children, iconColor = "text-indigo-500" }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <p className="text-xs text-muted-foreground mb-1">{label}</p>
            <div className="text-sm font-semibold leading-tight">{children}</div>
          </div>
          <div className={cn("p-2 rounded-lg bg-muted/60 shrink-0", iconColor)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Compact goal row ─────────────────────────────────────────────────────────

function CompactGoalRow({ goal }: Readonly<{ goal: Goal }>) {
  const uomMeta = UOM_TYPE_META[goal.uomType];
  return (
    <div className="flex items-center gap-2 py-2 border-b border-muted/40 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground truncate">{goal.title}</p>
        <p className="text-[10px] text-muted-foreground truncate">
          {formatThrustArea(goal.thrustArea)}
        </p>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        {uomMeta && (
          <Badge
            variant="outline"
            className="text-[10px] h-4 px-1.5 py-0 font-normal"
          >
            {uomMeta.label}
          </Badge>
        )}
        <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0 rounded">
          {goal.weightage}%
        </span>
        <GoalStatusBadge status={goal.status} size="sm" />
      </div>
    </div>
  );
}

// ─── Cycle phase mini-timeline ────────────────────────────────────────────────

const CYCLE_PHASES = [
  { key: CyclePhase.GOAL_SETTING, label: "Goal Setting", months: "May" },
  { key: CyclePhase.Q1, label: "Q1 Review", months: "Jul" },
  { key: CyclePhase.Q2, label: "Q2 Review", months: "Oct" },
  { key: CyclePhase.Q3, label: "Q3 Review", months: "Jan" },
  { key: CyclePhase.Q4, label: "Final Review", months: "Apr" },
];

function CyclePhaseMini({ currentPhase }: Readonly<{ currentPhase: string | null }>) {
  const currentIndex = CYCLE_PHASES.findIndex((p) => p.key === currentPhase);

  return (
    <div className="space-y-1">
      {CYCLE_PHASES.map((phase, i) => {
        let state: "done" | "active" | "upcoming";
        if (i < currentIndex) state = "done";
        else if (i === currentIndex) state = "active";
        else state = "upcoming";

        return (
          <div key={phase.key} className="flex items-center gap-2">
            <div
              className={cn(
                "h-2 w-2 rounded-full shrink-0",
                state === "done" && "bg-emerald-500",
                state === "active" && "bg-indigo-500 ring-2 ring-indigo-200",
                state === "upcoming" && "bg-muted border border-muted-foreground/20"
              )}
            />
            <span
              className={cn(
                "text-xs flex-1",
                state === "done" && "text-emerald-600 line-through",
                state === "active" && "text-indigo-700 font-semibold",
                state === "upcoming" && "text-muted-foreground"
              )}
            >
              {phase.label}
            </span>
            <span className="text-[10px] text-muted-foreground">{phase.months}</span>
          </div>
        );
      })}
    </div>
  );
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

function QuickActions({
  sheetStatus,
  isWindowOpen,
  isValid,
}: Readonly<{
  sheetStatus: GoalSheetStatus | undefined;
  isWindowOpen: boolean;
  isValid: boolean;
}>) {
  const actions = buildQuickActions(sheetStatus, isWindowOpen, isValid);

  return (
    <div className="space-y-2">
      {actions.map((action) => (
        <Link key={action.href} to={action.href}>
          <Button
            variant={action.primary ? "default" : "outline"}
            size="sm"
            className="w-full justify-start gap-2 h-8 text-xs"
          >
            <action.icon className="h-3.5 w-3.5" />
            {action.label}
          </Button>
        </Link>
      ))}
    </div>
  );
}

interface ActionItem {
  label: string;
  href: string;
  icon: React.ElementType;
  primary: boolean;
}

function buildQuickActions(
  sheetStatus: GoalSheetStatus | undefined,
  isWindowOpen: boolean,
  isValid: boolean
): ActionItem[] {
  if (!isWindowOpen) {
    return [
      { label: "View My Goals", href: ROUTES.EMPLOYEE.GOALS, icon: Eye, primary: false },
      { label: "Quarterly Update", href: ROUTES.EMPLOYEE.QUARTERLY_UPDATE, icon: TrendingUp, primary: false },
    ];
  }

  if (sheetStatus === GoalStatus.APPROVED) {
    return [
      { label: "View Approved Goals", href: ROUTES.EMPLOYEE.GOALS, icon: CheckCircle, primary: false },
      { label: "Quarterly Update", href: ROUTES.EMPLOYEE.QUARTERLY_UPDATE, icon: TrendingUp, primary: true },
    ];
  }

  if (sheetStatus === GoalStatus.SUBMITTED) {
    return [
      { label: "Track Status", href: ROUTES.EMPLOYEE.GOALS, icon: Eye, primary: false },
    ];
  }

  return [
    { label: "Add a Goal", href: ROUTES.EMPLOYEE.GOALS, icon: Plus, primary: true },
    ...(isValid
      ? [{ label: "Submit Goal Sheet", href: ROUTES.EMPLOYEE.GOALS, icon: Send, primary: false }]
      : []),
  ];
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { currentUser } = useAuth();
  const { data: goals = [], isLoading: goalsLoading } = useMyGoals(CYCLE_ID);
  const { data: sheet, isLoading: sheetLoading } = useMySheet(CYCLE_ID);
  const { isWindowOpen, daysRemaining, currentPhase } = useWindowStatus();
  const { totalWeightage, isValid, goalCount } = useWeightage(goals);

  const isLoading = goalsLoading || sheetLoading;
  const sheetStatus = sheet?.status;

  // Weightage color
  let weightageColor = "text-amber-600";
  if (totalWeightage === 100) weightageColor = "text-emerald-600";
  else if (totalWeightage > 100) weightageColor = "text-red-600";

  // Days remaining color
  let daysColor = "text-emerald-600";
  if (!isWindowOpen) daysColor = "text-slate-500";
  else if (daysRemaining <= 3) daysColor = "text-red-600";
  else if (daysRemaining <= 7) daysColor = "text-amber-600";

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          Welcome back{currentUser?.fullName ? `, ${currentUser.name.split(" ")[0]}` : ""}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">FY 2026 · Goal Setting Phase</p>
      </div>

      {/* Window closed banner */}
      {!isWindowOpen && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>The goal-setting window is closed. Your sheet is locked for review.</span>
        </div>
      )}

      {/* Metric cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Target} label="Goals Added" iconColor="text-indigo-500">
            <span className="text-lg">{goalCount}</span>
            <span className="text-muted-foreground font-normal"> / 8</span>
          </MetricCard>

          <MetricCard icon={TrendingUp} label="Weightage" iconColor="text-emerald-500">
            <span className={cn("text-lg", weightageColor)}>{totalWeightage}%</span>
            <span className="text-muted-foreground font-normal text-xs"> of 100%</span>
          </MetricCard>

          <MetricCard icon={CheckCircle} label="Sheet Status" iconColor="text-blue-500">
            {sheetStatus ? (
              <GoalStatusBadge status={sheetStatus} />
            ) : (
              <span className="text-muted-foreground font-normal">Not started</span>
            )}
          </MetricCard>

          <MetricCard icon={Clock} label="Days Remaining" iconColor="text-amber-500">
            {isWindowOpen ? (
              <>
                <span className={cn("text-lg", daysColor)}>{daysRemaining}</span>
                <span className="text-muted-foreground font-normal"> days</span>
              </>
            ) : (
              <span className="text-slate-500 font-normal text-xs">Window closed</span>
            )}
          </MetricCard>
        </div>
      )}

      {/* Body — goal list + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Goal list — 3/5 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">My Goals</CardTitle>
                <Link
                  to={ROUTES.EMPLOYEE.GOALS}
                  className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {["a", "b", "c"].map((k) => (
                    <Skeleton key={k} className="h-10 w-full" />
                  ))}
                </div>
              ) : goals.length === 0 ? (
                <EmptyState
                  variant="no-goals"
                  className="py-8"
                  action={{ label: "Add First Goal", onClick: () => undefined }}
                />
              ) : (
                <div>
                  {goals.slice(0, 5).map((goal) => (
                    <CompactGoalRow key={goal.id} goal={goal} />
                  ))}
                  {goals.length > 5 && (
                    <Link
                      to={ROUTES.EMPLOYEE.GOALS}
                      className="block text-center text-xs text-indigo-600 hover:underline pt-2"
                    >
                      +{goals.length - 5} more goals
                    </Link>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar — 2/5 */}
        <div className="lg:col-span-2 space-y-4">
          {/* Quick Actions */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-2">
                  {["a", "b"].map((k) => (
                    <Skeleton key={k} className="h-8 w-full" />
                  ))}
                </div>
              ) : (
                <QuickActions
                  sheetStatus={sheetStatus}
                  isWindowOpen={isWindowOpen}
                  isValid={isValid}
                />
              )}
            </CardContent>
          </Card>

          {/* Cycle Timeline */}
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">FY 2026 Timeline</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              <CyclePhaseMini currentPhase={currentPhase} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
