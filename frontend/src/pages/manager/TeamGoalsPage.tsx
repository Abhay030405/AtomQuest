import { useState, useMemo } from "react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, X, Eye } from "lucide-react";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { GoalVersionDrawer } from "@/components/goals/GoalVersionDrawer";
import { EmptyState } from "@/components/shared/EmptyState";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { formatDate } from "@/utils/date.util";
import { useTeamGoals } from "@/hooks/useGoals";
import { useDirectReports } from "@/hooks/useApprovals";
import { useAuth } from "@/hooks/useAuth";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { GoalStatus, ThrustArea, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

// ─── Target display ───────────────────────────────────────────────────────────

function TargetCell({ goal }: Readonly<{ goal: Goal }>) {
  if (goal.uomType === UoMType.ZERO) return <span className="text-xs">0 (Zero)</span>;
  if (goal.uomType === UoMType.TIMELINE) {
    return (
      <span className="text-xs">
        {goal.targetDate ? formatDate(goal.targetDate, "dd MMM yyyy") : "—"}
      </span>
    );
  }
  return <span className="text-xs tabular-nums">{goal.targetValue ?? "—"}</span>;
}

// ─── Goal detail sheet ────────────────────────────────────────────────────────

interface GoalDetailSheetProps {
  readonly goal: Goal | null;
  readonly open: boolean;
  readonly onClose: () => void;
}

function GoalDetailSheet({ goal, open, onClose }: GoalDetailSheetProps) {
  const [historyOpen, setHistoryOpen] = useState(false);
  if (!goal) return null;

  const user = USERS_BY_ID[goal.userId];
  const uomMeta = UOM_TYPE_META[goal.uomType];

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle className="text-sm leading-snug">{goal.title}</SheetTitle>
            <SheetDescription>
              {user?.fullName ?? "Unknown"} · {formatThrustArea(goal.thrustArea)}
            </SheetDescription>
          </SheetHeader>

          <div className="space-y-4 text-sm">
            {goal.description && (
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Description</p>
                <p className="text-xs leading-relaxed">{goal.description}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Measurement</p>
                <Badge variant="outline" className="text-[10px]">
                  {uomMeta?.label ?? goal.uomType}
                </Badge>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Target</p>
                <TargetCell goal={goal} />
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Weightage</p>
                <span className="text-xs font-semibold">{goal.weightage}%</span>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1 font-medium">Status</p>
                <GoalStatusBadge status={goal.status} size="sm" />
              </div>
            </div>

            <div>
              <p className="text-xs text-muted-foreground mb-1 font-medium">Added</p>
              <p className="text-xs">{formatDate(goal.createdAt, "dd MMM yyyy")}</p>
            </div>

            {goal.isShared && (
              <Badge className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px]">
                Shared KPI
              </Badge>
            )}
          </div>

          <div className="mt-6 pt-4 border-t">
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2"
              onClick={() => setHistoryOpen(true)}
            >
              <Eye className="h-3.5 w-3.5" />
              View Version History
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      <GoalVersionDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        goalId={goal.id}
        goalTitle={goal.title}
      />
    </>
  );
}

// ─── TeamGoalsPage ────────────────────────────────────────────────────────────

export default function TeamGoalsPage() {
  const { currentUser } = useAuth();
  const { data: allGoals = [], isLoading: goalsLoading } = useTeamGoals(CYCLE_ID);
  const { data: directReports = [], isLoading: reportsLoading } = useDirectReports();

  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [thrustFilter, setThrustFilter] = useState("");
  const [viewGoal, setViewGoal] = useState<Goal | null>(null);

  const isLoading = goalsLoading || reportsLoading;

  const reportIds = directReports.map((u) => u.id);

  // Filter to only direct reports' goals for the cycle
  const teamGoals = allGoals.filter((g) => reportIds.includes(g.userId) && g.cycleId === CYCLE_ID);

  // Summary counts
  const approvedCount = teamGoals.filter((g) => g.status === GoalStatus.APPROVED || g.status === GoalStatus.LOCKED).length;
  const pendingCount = teamGoals.filter((g) => g.status === GoalStatus.SUBMITTED || g.status === GoalStatus.UNDER_REVIEW).length;
  const uniqueEmployees = new Set(teamGoals.map((g) => g.userId)).size;

  // Unique thrust areas for filter
  const thrustAreas = Array.from(new Set(teamGoals.map((g) => g.thrustArea)));

  const filtered = useMemo(() => {
    return teamGoals.filter((goal) => {
      const user = USERS_BY_ID[goal.userId];
      if (nameFilter) {
        const name = user?.fullName.toLowerCase() ?? "";
        if (!name.includes(nameFilter.toLowerCase())) return false;
      }
      if (statusFilter && goal.status !== statusFilter) return false;
      if (thrustFilter && goal.thrustArea !== thrustFilter) return false;
      return true;
    });
  }, [teamGoals, nameFilter, statusFilter, thrustFilter]);

  const hasFilter = Boolean(nameFilter || statusFilter || thrustFilter);

  function clearFilters() {
    setNameFilter("");
    setStatusFilter("");
    setThrustFilter("");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Team Goals</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          All goals across your direct reports for FY 2026
        </p>
      </div>

      {/* Stats bar */}
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/40 border text-xs">
          <span className="font-semibold text-foreground">
            {teamGoals.length} goal{teamGoals.length !== 1 ? "s" : ""} across {uniqueEmployees} employee{uniqueEmployees !== 1 ? "s" : ""}
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-emerald-600 font-medium">{approvedCount} approved</span>
          {pendingCount > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-600 font-medium">{pendingCount} pending review</span>
            </>
          )}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employee…"
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="h-8 pl-8 text-xs w-44"
          />
        </div>

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
        >
          <option value="">All statuses</option>
          {Object.values(GoalStatus).map((s) => (
            <option key={s} value={s}>
              {s.charAt(0).toUpperCase() + s.slice(1).replace(/-/g, " ")}
            </option>
          ))}
        </select>

        {thrustAreas.length > 1 && (
          <select
            value={thrustFilter}
            onChange={(e) => setThrustFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All thrust areas</option>
            {thrustAreas.map((t) => (
              <option key={t} value={t}>{formatThrustArea(t as ThrustArea)}</option>
            ))}
          </select>
        )}

        {hasFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground gap-1"
            onClick={clearFilters}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-2">
          {["a", "b", "c", "d"].map((k) => <Skeleton key={k} className="h-12 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState variant="no-team-goals" className="py-12" />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Employee</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground">Goal Title</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground hidden md:table-cell">UoM</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground hidden lg:table-cell">Target</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Wt.</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Added</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((goal) => {
                const user = USERS_BY_ID[goal.userId];
                const uomMeta = UOM_TYPE_META[goal.uomType];
                return (
                  <tr
                    key={goal.id}
                    className="border-b border-muted/30 hover:bg-muted/20 transition-colors cursor-pointer"
                    onClick={() => setViewGoal(goal)}
                  >
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">{user?.fullName ?? "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{user?.departmentName}</p>
                    </td>
                    <td className="px-3 py-3 max-w-[180px]">
                      <p className="font-medium text-foreground truncate">{goal.title}</p>
                      <p className="text-[10px] text-muted-foreground truncate">
                        {formatThrustArea(goal.thrustArea)}
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <Badge variant="outline" className="text-[10px] h-5 font-normal px-1.5">
                        {uomMeta?.label ?? goal.uomType}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 text-right hidden lg:table-cell text-muted-foreground">
                      <TargetCell goal={goal} />
                    </td>
                    <td className="px-3 py-3 text-right">
                      <span className="font-semibold tabular-nums">{goal.weightage}%</span>
                    </td>
                    <td className="px-3 py-3 text-center">
                      <GoalStatusBadge status={goal.status} size="sm" />
                    </td>
                    <td className="px-3 py-3 text-right text-muted-foreground hidden sm:table-cell">
                      {formatDate(goal.createdAt, "dd MMM")}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground"
                        title="View goal details"
                        onClick={(e) => {
                          e.stopPropagation();
                          setViewGoal(goal);
                        }}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Goal detail sheet */}
      <GoalDetailSheet
        goal={viewGoal}
        open={viewGoal !== null}
        onClose={() => setViewGoal(null)}
      />
    </div>
  );
}
