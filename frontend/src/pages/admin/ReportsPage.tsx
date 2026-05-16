import { useState, useMemo } from "react";
import { useAllGoals } from "@/hooks/useGoals";
import { useAdminAllSheets, useAdminAuditLog } from "@/hooks/useAdmin";
import { mockUsers, USERS_BY_ID } from "@/mocks/mockUsers";
import { GoalStatus } from "@/types/goal.types";
import { UserRole } from "@/types/user.types";
import { formatDate } from "@/utils/date.util";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

const SHEET_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  approved:     { cls: "bg-tertiary/10 text-tertiary", label: "Approved" },
  submitted:    { cls: "bg-secondary-container text-on-secondary-container", label: "Submitted" },
  under_review: { cls: "bg-secondary-container text-on-secondary-container", label: "Under Review" },
  draft:        { cls: "bg-surface-variant text-on-surface-variant", label: "Draft" },
  rework:       { cls: "bg-error/10 text-error", label: "Rework" },
  locked:       { cls: "bg-tertiary/10 text-tertiary", label: "Locked" },
};

const CHART_BARS = [
  { month: "Jan", plan: 60, actual: 48 },
  { month: "Feb", plan: 70, actual: 52 },
  { month: "Mar", plan: 65, actual: 59 },
  { month: "Apr", plan: 85, actual: 51 },
  { month: "May", plan: 90, actual: 77 },
  { month: "Jun", plan: 100, actual: 95 },
];

export default function ReportsPage() {
  const { data: allGoals = [], isLoading: goalsLoading } = useAllGoals(CYCLE_ID);
  const { data: allSheetsRes, isLoading: sheetsLoading } = useAdminAllSheets(CYCLE_ID);
  const { data: auditPage, isLoading: auditLoading } = useAdminAuditLog({ pageSize: 10 });

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const isLoading = goalsLoading || sheetsLoading;
  const sheets = allSheetsRes?.items ?? [];
  const auditLogs = auditPage?.items ?? [];

  const employees = mockUsers.filter((u) => u.role === UserRole.EMPLOYEE);

  const employeeRows = useMemo(() => employees.map((user) => {
    const sheet = sheets.find((s: any) => s.userId === user.id);
    const goals = allGoals.filter((g: any) => g.userId === user.id);
    const manager = mockUsers.find((u2) => u2.id === user.managerId);
    return {
      user,
      sheet,
      goalCount: goals.length,
      totalWeightage: goals.reduce((s: number, g: any) => s + (g.weightage ?? 0), 0),
      sheetStatus: sheet?.status ?? null,
      submittedAt: sheet?.submittedAt ?? null,
      managerName: manager?.fullName ?? "—",
    };
  }), [employees, sheets, allGoals]);

  const filtered = useMemo(() => employeeRows.filter((row) => {
    if (search && !row.user.fullName.toLowerCase().includes(search.toLowerCase())) return false;
    if (statusFilter && row.sheetStatus !== statusFilter) return false;
    return true;
  }), [employeeRows, search, statusFilter]);

  const approvedCount = sheets.filter((s: any) => s.status === GoalStatus.APPROVED || s.status === GoalStatus.LOCKED).length;
  const avgTurnaround = 4.2;
  const checkInPct = 87;

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
              <h3 className="text-title-lg text-on-surface">Achievement Trends</h3>
              <p className="text-label-md text-on-surface-variant">Planned vs. Actual Goal Completion</p>
            </div>
            <button className="text-on-surface-variant hover:text-primary transition-colors">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div className="flex-1 min-h-[240px] flex items-end gap-sm pt-md relative">
            <div className="absolute top-0 left-0 w-full h-full border-l border-b border-outline-variant opacity-50" />
            {CHART_BARS.map((bar) => (
              <div key={bar.month} className="flex-1 flex flex-col justify-end items-center gap-xs z-10 h-full">
                <div className="w-full flex flex-col items-center gap-xs" style={{ height: `${bar.plan}%` }}>
                  <div className="w-full flex flex-col justify-end h-full relative">
                    <div className="w-full bg-primary-container/30 rounded-t-sm h-full relative">
                      <div
                        className="absolute bottom-0 w-full bg-primary rounded-t-sm transition-all"
                        style={{ height: `${(bar.actual / bar.plan) * 100}%` }}
                      />
                    </div>
                  </div>
                </div>
                <span className="text-label-md text-on-surface-variant text-[10px]">{bar.month}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Metrics column */}
        <div className="flex flex-col gap-lg">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg">
            <h3 className="text-title-md text-on-surface mb-xs">Review Turnaround</h3>
            <p className="text-label-md text-on-surface-variant mb-md">Average time to complete reviews</p>
            <div className="flex items-baseline gap-sm">
              <span className="text-display-lg text-on-surface">{avgTurnaround}</span>
              <span className="text-body-lg text-on-surface-variant">days</span>
            </div>
            <div className="mt-md flex items-center gap-sm text-tertiary-container text-label-md bg-tertiary/10 w-fit px-sm py-xs rounded">
              <span className="material-symbols-outlined text-[16px]">arrow_downward</span>
              12% vs last cycle
            </div>
          </div>

          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg">
            <h3 className="text-title-md text-on-surface mb-xs">Check-in Completion</h3>
            <p className="text-label-md text-on-surface-variant mb-md">1-on-1s logged in system</p>
            <div className="flex items-baseline gap-sm">
              <span className="text-display-lg text-on-surface">{checkInPct}</span>
              <span className="text-body-lg text-on-surface-variant">%</span>
            </div>
            <div className="mt-md w-full bg-surface-variant rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${checkInPct}%` }} />
            </div>
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
              {isLoading ? (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="py-xl text-center text-on-surface-variant">No records found</td></tr>
              ) : (
                filtered.map((row) => {
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
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <div className="p-sm px-md border-t border-outline-variant bg-surface-container text-label-md text-on-surface-variant flex justify-between items-center">
            <span>Showing {filtered.length} of {employeeRows.length} employees</span>
          </div>
        )}
      </div>

      {/* Recent Audit Logs */}
      {!auditLoading && auditLogs.length > 0 && (
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <div>
              <h3 className="text-title-lg text-on-surface">Recent Audit Logs</h3>
              <p className="text-label-md text-on-surface-variant">System modifications and access trail</p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-surface-container text-on-surface-variant text-label-md uppercase tracking-wider border-b border-outline-variant">
                  <th className="p-md font-medium min-w-[150px]">Timestamp</th>
                  <th className="p-md font-medium min-w-[180px]">User</th>
                  <th className="p-md font-medium min-w-[140px]">Action</th>
                  <th className="p-md font-medium min-w-[200px]">Details</th>
                </tr>
              </thead>
              <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/50">
                {auditLogs.map((log: any) => {
                  const initials = log.actorName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  const actionBg = log.action === "INSERT" ? "bg-tertiary-container/20 text-tertiary"
                    : log.action === "DELETE" ? "bg-error-container/50 text-on-error-container"
                    : "bg-surface-variant text-on-surface-variant";
                  return (
                    <tr key={log.id} className="hover:bg-surface-bright transition-colors">
                      <td className="p-md whitespace-nowrap text-on-surface-variant font-code text-[12px]">
                        {new Date(log.changedAt).toLocaleString("en-US", { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </td>
                      <td className="p-md">
                        <div className="flex items-center gap-sm">
                          <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md text-[10px]">
                            {initials}
                          </div>
                          <span>{log.actorName}</span>
                        </div>
                      </td>
                      <td className="p-md">
                        <span className={cn("px-2 py-1 rounded font-code text-[11px]", actionBg)}>
                          {log.action}_{log.tableName?.toUpperCase()}
                        </span>
                      </td>
                      <td className="p-md text-on-surface-variant">
                        {log.fieldName ? `${log.fieldName}: ${log.oldValue ?? "—"} → ${log.newValue ?? "—"}` : log.tableName}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
