import { useState, useMemo } from "react";
import { useAllGoals } from "@/hooks/useGoals";
import { useAdminAllSheets } from "@/hooks/useAdmin";
import { useAllUsers } from "@/hooks/useApprovals";
import { useCycleStore } from "@/store/cycleStore";
import { GoalStatus } from "@/types/goal.types";
import { UserRole } from "@/types/user.types";
import { formatDate } from "@/utils/date.util";
import { cn } from "@/lib/utils";

const SHEET_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  approved:     { cls: "bg-tertiary/10 text-tertiary", label: "Approved" },
  submitted:    { cls: "bg-secondary-container text-on-secondary-container", label: "Submitted" },
  under_review: { cls: "bg-secondary-container text-on-secondary-container", label: "Under Review" },
  draft:        { cls: "bg-surface-variant text-on-surface-variant", label: "Draft" },
  rework:       { cls: "bg-error/10 text-error", label: "Rework" },
  locked:       { cls: "bg-tertiary/10 text-tertiary", label: "Locked" },
};

export default function ReportsPage() {
  const cycleId = useCycleStore((s) => s.activeWindow?.id ?? "");
  const { data: allGoals = [], isLoading: goalsLoading } = useAllGoals(cycleId);
  const { data: allSheetsRes, isLoading: sheetsLoading } = useAdminAllSheets(cycleId);
  const { data: allUsers = [], isLoading: usersLoading } = useAllUsers();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isLoading = goalsLoading || sheetsLoading || usersLoading;
  const sheets = allSheetsRes?.items ?? [];

  const employees = allUsers.filter((u) => u.role === UserRole.EMPLOYEE);

  const employeeRows = useMemo(() => employees.map((user) => {
    const sheet = sheets.find((s) => s.userId === user.id);
    const goals = allGoals.filter((g) => g.userId === user.id);
    return {
      user,
      sheet,
      goalCount: goals.length,
      totalWeightage: goals.reduce((s, g) => s + (g.weightage ?? 0), 0),
      sheetStatus: sheet?.status ?? null,
      submittedAt: sheet?.submittedAt ?? null,
      managerName: user.managerName ?? "—",
    };
  }), [employees, sheets, allGoals]);

  const filtered = useMemo(() => employeeRows.filter((row) => {
    if (search && !row.user.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && row.sheetStatus !== statusFilter) return false;
    return true;
  }), [employeeRows, search, statusFilter]);

  const approvedCount = sheets.filter((s) => s.status === GoalStatus.APPROVED || s.status === GoalStatus.LOCKED).length;
  const submittedCount = sheets.filter((s) => s.status !== GoalStatus.DRAFT).length;
  const submissionPct = employees.length > 0 ? Math.round((submittedCount / employees.length) * 100) : 0;

  // Compute avg review turnaround from real sheet timestamps
  const turnaroundSamples = sheets
    .filter((s) => s.submittedAt && s.approvedAt)
    .map((s) => (new Date(s.approvedAt!).getTime() - new Date(s.submittedAt!).getTime()) / 86_400_000);
  const avgTurnaround = turnaroundSamples.length > 0
    ? Math.round((turnaroundSamples.reduce((a, b) => a + b, 0) / turnaroundSamples.length) * 10) / 10
    : null;

  // Goal status distribution for chart
  const goalStatusBars = [
    { label: "Draft",     count: allGoals.filter((g) => g.status === GoalStatus.DRAFT).length,     cls: "bg-surface-variant" },
    { label: "Submitted", count: allGoals.filter((g) => g.status === GoalStatus.SUBMITTED).length, cls: "bg-secondary" },
    { label: "Approved",  count: allGoals.filter((g) => g.status === GoalStatus.APPROVED || g.status === GoalStatus.LOCKED).length, cls: "bg-tertiary" },
    { label: "Rework",    count: allGoals.filter((g) => g.status === GoalStatus.REWORK).length,    cls: "bg-error" },
  ];
  const maxGoalCount = Math.max(...goalStatusBars.map((b) => b.count), 1);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="text-headline-lg text-on-surface">Org-Wide Analytics</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">Comprehensive view of performance and compliance.</p>
        </div>
        <div className="flex items-center gap-sm">
          <button className="flex items-center gap-sm px-md py-sm bg-surface-container-low text-on-surface border border-outline-variant rounded-lg text-label-md hover:bg-surface-container-high transition-colors shadow-level-1">
            <span className="material-symbols-outlined text-[18px]">calendar_today</span>
            FY 2026
          </button>
          <button className="flex items-center gap-sm px-md py-sm bg-primary text-on-primary rounded-lg text-label-md hover:opacity-90 transition-opacity shadow-level-1 border-t border-white/20">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export
          </button>
        </div>
      </div>

      {/* Dashboard grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Achievement Trends (large card) */}
        <div className="lg:col-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg flex flex-col">
          <div className="flex justify-between items-start mb-md border-b border-outline-variant pb-md">
            <div>
              <h3 className="text-title-lg text-on-surface">Goal Status Distribution</h3>
              <p className="text-label-md text-on-surface-variant">Breakdown of goals by current status</p>
            </div>
          </div>
          <div className="flex-1 min-h-[240px] flex items-end gap-sm pt-md relative">
            <div className="absolute top-0 left-0 w-full h-full border-l border-b border-outline-variant opacity-50" />
            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <span className="text-on-surface-variant text-body-md">Loading…</span>
              </div>
            ) : goalStatusBars.map((bar) => (
              <div key={bar.label} className="flex-1 flex flex-col justify-end items-center gap-xs z-10 h-full">
                <span className="text-label-sm text-on-surface-variant">{bar.count}</span>
                <div
                  className={`w-full ${bar.cls} rounded-t-sm transition-all`}
                  style={{ height: `${Math.round((bar.count / maxGoalCount) * 100)}%`, minHeight: bar.count > 0 ? "4px" : "0" }}
                />
                <span className="text-label-md text-on-surface-variant text-[10px] text-center">{bar.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics column */}
        <div className="flex flex-col gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg">
            <h3 className="text-title-md text-on-surface mb-xs">Review Turnaround</h3>
            <p className="text-label-md text-on-surface-variant mb-md">Avg days from submission to approval</p>
            <div className="flex items-baseline gap-sm">
              {avgTurnaround === null ? (
                <span className="text-title-lg text-on-surface-variant">No data yet</span>
              ) : (
                <>
                  <span className="text-display-lg text-on-surface">{avgTurnaround}</span>
                  <span className="text-body-lg text-on-surface-variant">days</span>
                </>
              )}
            </div>
            {avgTurnaround !== null && (
              <p className="mt-xs text-label-sm text-on-surface-variant">
                Based on {turnaroundSamples.length} approved sheet{turnaroundSamples.length === 1 ? "" : "s"}
              </p>
            )}
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg">
            <h3 className="text-title-md text-on-surface mb-xs">Sheet Submission Rate</h3>
            <p className="text-label-md text-on-surface-variant mb-md">Employees who submitted a goal sheet</p>
            <div className="flex items-baseline gap-sm">
              <span className="text-display-lg text-on-surface">{isLoading ? "—" : submissionPct}</span>
              <span className="text-body-lg text-on-surface-variant">%</span>
            </div>
            <div className="mt-md w-full bg-surface-variant rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${submissionPct}%` }} />
            </div>
            <p className="mt-xs text-label-sm text-on-surface-variant">
              {isLoading ? "" : `${submittedCount} of ${employees.length} employees`}
            </p>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg">
            <h3 className="text-title-md text-on-surface mb-xs">Sheets Approved</h3>
            <p className="text-label-md text-on-surface-variant mb-md">Fully processed goal sheets</p>
            <div className="flex items-baseline gap-sm">
              <span className="text-display-lg text-on-surface">{isLoading ? "—" : approvedCount}</span>
              <span className="text-body-lg text-on-surface-variant">of {sheets.length}</span>
            </div>
            <div className="mt-md w-full bg-surface-variant rounded-full h-2">
              <div
                className="bg-tertiary h-2 rounded-full transition-all"
                style={{ width: `${sheets.length > 0 ? Math.round((approvedCount / sheets.length) * 100) : 0}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Employee completion table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
        <div className="p-lg border-b border-outline-variant bg-surface-bright flex flex-col sm:flex-row sm:items-center justify-between gap-md">
          <div>
            <h3 className="text-title-lg text-on-surface">Employee Goal Status</h3>
            <p className="text-label-md text-on-surface-variant">Submission and approval tracker for FY 2026</p>
          </div>
          <div className="flex items-center gap-sm">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
              <input
                type="text"
                placeholder="Search employee..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-xl pr-sm py-xs bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md focus:border-primary focus:outline-none w-48"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg py-xs pl-sm pr-lg focus:border-primary focus:outline-none"
            >
              <option value="">All Statuses</option>
              <option value="approved">Approved</option>
              <option value="submitted">Submitted</option>
              <option value="draft">Draft</option>
              <option value="rework">Rework</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant text-label-md uppercase tracking-wider border-b border-outline-variant">
                <th className="py-sm px-md font-medium">Employee</th>
                <th className="py-sm px-md font-medium hidden md:table-cell">Manager</th>
                <th className="py-sm px-md font-medium text-center hidden sm:table-cell">Goals</th>
                <th className="py-sm px-md font-medium text-center hidden lg:table-cell">Weightage</th>
                <th className="py-sm px-md font-medium hidden sm:table-cell">Submitted</th>
                <th className="py-sm px-md font-medium">Status</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/50">
              {isLoading && (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">Loading...</td></tr>
              )}
              {!isLoading && filtered.length === 0 && (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">No records found</td></tr>
              )}
              {!isLoading && filtered.length > 0 && filtered.map((row) => {
                  const chip = SHEET_STATUS_CHIP[row.sheetStatus ?? "draft"] ?? SHEET_STATUS_CHIP["draft"];
                  const initials = row.user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <tr key={row.user.id} className="hover:bg-surface-container-low transition-colors">
                      <td className="py-md px-md">
                        <div className="flex items-center gap-sm">
                          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md shrink-0">
                            {initials}
                          </div>
                          <div>
                            <p className="text-title-md text-on-surface">{row.user.fullName}</p>
                            <p className="text-label-md text-on-surface-variant">{row.user.departmentName}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-md px-md text-on-surface-variant hidden md:table-cell">{row.managerName}</td>
                      <td className="py-md px-md text-center hidden sm:table-cell">
                        <span className="text-title-md text-on-surface">{row.goalCount}</span>
                      </td>
                      <td className="py-md px-md text-center hidden lg:table-cell">
                        <span className={cn("text-title-md", row.totalWeightage === 100 ? "text-tertiary" : "text-error")}>
                          {row.totalWeightage}%
                        </span>
                      </td>
                      <td className="py-md px-md text-on-surface-variant hidden sm:table-cell">
                        {row.submittedAt ? formatDate(row.submittedAt, "dd MMM yyyy") : "—"}
                      </td>
                      <td className="py-md px-md">
                        <span className={cn("inline-flex items-center px-2 py-1 rounded-md text-label-md", chip.cls)}>
                          {chip.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <div className="p-sm px-md border-t border-outline-variant bg-surface-container text-label-md text-on-surface-variant flex justify-between items-center">
            <span>Showing {filtered.length} of {employeeRows.length} employees</span>
          </div>
        )}
      </div>
    </div>
  );
}
