import { useState, useMemo } from "react";
import { useTeamGoals } from "@/hooks/useGoals";
import { useDirectReports } from "@/hooks/useApprovals";
import { useAuth } from "@/hooks/useAuth";
import { useCycleStore } from "@/store/cycleStore";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { GoalStatus } from "@/types/goal.types";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const CYCLE_ID = "cycle-fy2026";

const GOAL_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  [GoalStatus.DRAFT]:        { cls: "bg-surface-variant text-on-surface-variant", label: "Draft" },
  [GoalStatus.SUBMITTED]:    { cls: "bg-secondary-container text-on-secondary-container", label: "Submitted" },
  [GoalStatus.UNDER_REVIEW]: { cls: "bg-secondary-container text-on-secondary-container", label: "Under Review" },
  [GoalStatus.APPROVED]:     { cls: "bg-tertiary/10 text-tertiary", label: "Approved" },
  [GoalStatus.LOCKED]:       { cls: "bg-tertiary/10 text-tertiary", label: "Locked" },
  [GoalStatus.ARCHIVED]:     { cls: "bg-surface-variant text-on-surface-variant", label: "Archived" },
};

export default function TeamGoalsPage() {
  const { currentUser } = useAuth();
  const { activeConfig } = useCycleStore();
  const cycleLabel = activeConfig?.name ?? "FY 2026";

  const { data: allGoals = [], isLoading: goalsLoading } = useTeamGoals(CYCLE_ID);
  const { data: directReports = [], isLoading: reportsLoading } = useDirectReports();

  const [nameFilter, setNameFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [viewGoal, setViewGoal] = useState<any | null>(null);

  const isLoading = goalsLoading || reportsLoading;

  const reportIds = useMemo(() => directReports.map((u: any) => u.id), [directReports]);
  const teamGoals = useMemo(
    () => allGoals.filter((g: any) => reportIds.includes(g.userId)),
    [allGoals, reportIds]
  );

  const approvedCount = teamGoals.filter((g: any) =>
    g.status === GoalStatus.APPROVED || g.status === GoalStatus.LOCKED
  ).length;
  const pendingCount = teamGoals.filter((g: any) =>
    g.status === GoalStatus.SUBMITTED || g.status === GoalStatus.UNDER_REVIEW
  ).length;
  const uniqueEmployees = new Set(teamGoals.map((g: any) => g.userId)).size;

  const filtered = useMemo(() => {
    return teamGoals.filter((goal: any) => {
      const user = USERS_BY_ID[goal.userId];
      if (nameFilter) {
        const name = (user?.fullName ?? "").toLowerCase();
        if (!name.includes(nameFilter.toLowerCase())) return false;
      }
      if (statusFilter && goal.status !== statusFilter) return false;
      return true;
    });
  }, [teamGoals, nameFilter, statusFilter]);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <p className="text-label-md text-primary uppercase tracking-wider mb-1">{cycleLabel}</p>
          <h2 className="text-headline-lg text-on-surface">Team Goals</h2>
          <p className="text-body-lg text-on-surface-variant mt-2">
            All objectives across your direct reports. Review individual goal status and weightage.
          </p>
        </div>
        <button className="bg-surface-container-lowest border border-outline-variant text-on-surface text-title-md py-2 px-md rounded-lg shadow-level-1 hover:bg-surface-container-low transition-colors flex items-center gap-sm shrink-0">
          <span className="material-symbols-outlined text-[18px]">filter_list</span>
          Filter
        </button>
      </div>

      {/* Summary bar */}
      {!isLoading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-level-1 flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Total Goals</span>
            <span className="text-display-lg text-on-surface">{teamGoals.length}</span>
            <span className="text-label-md text-on-surface-variant">{uniqueEmployees} employee{uniqueEmployees !== 1 ? "s" : ""}</span>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-level-1 flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Approved / Locked</span>
            <span className="text-display-lg text-on-surface">{approvedCount}</span>
            <div className="w-full bg-surface-variant rounded-full h-1.5 mt-xs">
              <div className="bg-tertiary h-1.5 rounded-full transition-all" style={{ width: `${teamGoals.length > 0 ? Math.round((approvedCount / teamGoals.length) * 100) : 0}%` }} />
            </div>
          </div>
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-level-1 flex flex-col gap-xs">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Pending Review</span>
            <span className="text-display-lg text-on-surface">{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="text-label-md text-error flex items-center gap-xs">
                <span className="material-symbols-outlined text-[14px]">warning</span>
                Awaiting action
              </span>
            )}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-sm">
        <div className="relative flex-1 min-w-[160px] max-w-xs">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search employee..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="w-full pl-xl pr-sm py-sm bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg py-sm pl-sm pr-lg focus:border-primary focus:outline-none"
        >
          <option value="">All Statuses</option>
          {Object.values(GoalStatus).map((s) => (
            <option key={s} value={s}>{s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</option>
          ))}
        </select>
        {(nameFilter || statusFilter) && (
          <button
            onClick={() => { setNameFilter(""); setStatusFilter(""); }}
            className="text-on-surface-variant hover:text-on-surface text-body-md flex items-center gap-xs px-sm py-sm rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Clear
          </button>
        )}
      </div>

      {/* Goals table */}
      {isLoading ? (
        <div className="space-y-sm">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-16 bg-surface-container-low rounded-xl animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
          <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">manage_search</span>
          <p className="text-body-lg text-on-surface-variant mt-md">
            {teamGoals.length === 0 ? "No goals found for your team" : "No goals match your filters"}
          </p>
        </div>
      ) : (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[700px]">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-label-md uppercase tracking-wider border-b border-outline-variant">
                  <th className="py-sm px-md font-medium">Employee</th>
                  <th className="py-sm px-md font-medium">Goal</th>
                  <th className="py-sm px-md font-medium hidden md:table-cell">UoM</th>
                  <th className="py-sm px-md font-medium text-right hidden lg:table-cell">Weightage</th>
                  <th className="py-sm px-md font-medium">Status</th>
                  <th className="py-sm px-md font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/50">
                {filtered.map((goal: any) => {
                  const user = USERS_BY_ID[goal.userId];
                  const uomMeta = UOM_TYPE_META[goal.uomType];
                  const chip = GOAL_STATUS_CHIP[goal.status] ?? GOAL_STATUS_CHIP[GoalStatus.DRAFT];
                  const initials = (user?.fullName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr
                      key={goal.id}
                      className="hover:bg-surface-container-low transition-colors cursor-pointer"
                      onClick={() => setViewGoal(goal)}
                    >
                      <td className="py-md px-md">
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <p className="text-title-md text-on-surface truncate">{user?.fullName ?? "Unknown"}</p>
                            <p className="text-label-md text-on-surface-variant truncate">{user?.departmentName ?? "—"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-md px-md max-w-[200px]">
                        <p className="text-title-md text-on-surface truncate">{goal.title}</p>
                        <p className="text-label-md text-on-surface-variant truncate">{formatThrustArea(goal.thrustArea)}</p>
                      </td>
                      <td className="py-md px-md hidden md:table-cell">
                        <span className="bg-surface-container text-on-surface-variant text-label-md px-2 py-1 rounded border border-outline-variant/50">
                          {uomMeta?.label ?? goal.uomType}
                        </span>
                      </td>
                      <td className="py-md px-md text-right hidden lg:table-cell">
                        <span className="text-title-md text-on-surface">{goal.weightage}%</span>
                      </td>
                      <td className="py-md px-md">
                        <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-label-md", chip.cls)}>
                          {chip.label}
                        </span>
                      </td>
                      <td className="py-md px-md text-right">
                        <button
                          className="p-sm rounded-full hover:bg-surface-container text-on-surface-variant hover:text-primary transition-colors"
                          title="View goal details"
                          onClick={(e) => { e.stopPropagation(); setViewGoal(goal); }}
                        >
                          <span className="material-symbols-outlined text-[20px]">visibility</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="p-sm px-md border-t border-outline-variant bg-surface-container text-label-md text-on-surface-variant">
            Showing {filtered.length} of {teamGoals.length} goals
          </div>
        </div>
      )}

      {/* Goal detail sheet */}
      <Sheet open={viewGoal !== null} onOpenChange={(open) => !open && setViewGoal(null)}>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-lg">
            <SheetTitle className="text-title-lg text-on-surface leading-snug">{viewGoal?.title}</SheetTitle>
          </SheetHeader>
          {viewGoal && (
            <div className="space-y-lg text-body-md">
              <div className="flex items-center gap-sm">
                <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-title-md">
                  {(USERS_BY_ID[viewGoal.userId]?.fullName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <p className="text-title-md text-on-surface">{USERS_BY_ID[viewGoal.userId]?.fullName ?? "Unknown"}</p>
                  <p className="text-label-md text-on-surface-variant">{USERS_BY_ID[viewGoal.userId]?.departmentName ?? "—"}</p>
                </div>
              </div>
              {viewGoal.description && (
                <div>
                  <p className="text-label-md text-on-surface-variant mb-xs uppercase tracking-wider">Description</p>
                  <p className="text-body-md text-on-surface leading-relaxed">{viewGoal.description}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-md bg-surface-container-lowest rounded-xl border border-outline-variant p-md">
                <div>
                  <p className="text-label-md text-on-surface-variant mb-xs">Measurement</p>
                  <span className="bg-surface-container text-on-surface-variant text-label-md px-2 py-1 rounded border border-outline-variant/50">
                    {UOM_TYPE_META[viewGoal.uomType]?.label ?? viewGoal.uomType}
                  </span>
                </div>
                <div>
                  <p className="text-label-md text-on-surface-variant mb-xs">Target</p>
                  <p className="text-title-md text-on-surface">{viewGoal.targetValue ?? "—"}</p>
                </div>
                <div>
                  <p className="text-label-md text-on-surface-variant mb-xs">Weightage</p>
                  <p className="text-title-md text-on-surface">{viewGoal.weightage}%</p>
                </div>
                <div>
                  <p className="text-label-md text-on-surface-variant mb-xs">Status</p>
                  <span className={cn(
                    "inline-flex items-center px-2 py-1 rounded-md text-label-md",
                    (GOAL_STATUS_CHIP[viewGoal.status] ?? GOAL_STATUS_CHIP[GoalStatus.DRAFT]).cls
                  )}>
                    {(GOAL_STATUS_CHIP[viewGoal.status] ?? GOAL_STATUS_CHIP[GoalStatus.DRAFT]).label}
                  </span>
                </div>
              </div>
              {viewGoal.isShared && (
                <div className="inline-flex items-center gap-xs px-2 py-1 rounded-md bg-secondary-container text-on-secondary-container text-label-md">
                  <span className="material-symbols-outlined text-[14px]">share</span>
                  Shared KPI
                </div>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
