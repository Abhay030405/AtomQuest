import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import { Search, X, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePendingApprovals } from "@/hooks/useGoals";
import { useDirectReports, useTeamSheets } from "@/hooks/useApprovals";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { GoalStatus } from "@/types/goal.types";
import type { GoalSheet } from "@/types/goal.types";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysColor(days: number): string {
  if (days > 7) return "text-red-600 font-semibold";
  if (days >= 3) return "text-amber-600 font-semibold";
  return "text-emerald-600";
}

function getDaysBadge(days: number): string {
  if (days > 7) return "bg-red-100 text-red-700 border border-red-200";
  if (days >= 3) return "bg-amber-100 text-amber-700 border border-amber-200";
  return "bg-emerald-100 text-emerald-700 border border-emerald-200";
}

// ─── Enriched sheet ───────────────────────────────────────────────────────────

interface EnrichedSheet extends GoalSheet {
  userName: string;
  departmentName: string;
  employeeCode: string;
  daysWaiting: number;
}

function enrichSheet(sheet: GoalSheet): EnrichedSheet {
  const user = USERS_BY_ID[sheet.userId];
  const days = sheet.submittedAt
    ? differenceInDays(new Date(), parseISO(sheet.submittedAt))
    : 0;
  return {
    ...sheet,
    userName: user?.fullName ?? "Unknown",
    departmentName: user?.departmentName ?? "—",
    employeeCode: user?.employeeCode ?? "—",
    daysWaiting: days,
  };
}

// ─── ApprovalQueuePage ────────────────────────────────────────────────────────

export default function ApprovalQueuePage() {
  const { data: pendingSheets = [], isLoading: pendingLoading } = usePendingApprovals();
  const { data: directReports = [], isLoading: reportsLoading } = useDirectReports();
  const { data: teamSheetsResponse, isLoading: sheetsLoading } = useTeamSheets(CYCLE_ID);

  const [nameSearch, setNameSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const isLoading = pendingLoading || reportsLoading || sheetsLoading;

  const reportIds = directReports.map((u) => u.id);
  const teamSheets = teamSheetsResponse?.items.filter((s) => reportIds.includes(s.userId)) ?? [];
  const approvedCount = teamSheets.filter((s) => s.status === GoalStatus.APPROVED).length;
  const returnedCount = teamSheets.filter((s) => s.status === GoalStatus.DRAFT && s.submittedAt).length;

  const myPendingSheets = pendingSheets.filter((s) => reportIds.includes(s.userId));
  const enriched = myPendingSheets.map(enrichSheet);

  // Unique departments for filter dropdown
  const departments = Array.from(new Set(enriched.map((s) => s.departmentName)));

  const filtered = useMemo(() => {
    return enriched.filter((sheet) => {
      if (nameSearch && !sheet.userName.toLowerCase().includes(nameSearch.toLowerCase())) {
        return false;
      }
      if (deptFilter && sheet.departmentName !== deptFilter) return false;
      if (fromDate && sheet.submittedAt && sheet.submittedAt < fromDate) return false;
      if (toDate && sheet.submittedAt) {
        const toEnd = toDate + "T23:59:59.999Z";
        if (sheet.submittedAt > toEnd) return false;
      }
      return true;
    });
  }, [enriched, nameSearch, deptFilter, fromDate, toDate]);

  const hasFilter = Boolean(nameSearch || deptFilter || fromDate || toDate);

  function clearFilters() {
    setNameSearch("");
    setDeptFilter("");
    setFromDate("");
    setToDate("");
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Approval Queue</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Review and approve your team&apos;s goal sheets for FY 2026
        </p>
      </div>

      {/* Summary stat bar */}
      {!isLoading && (
        <div className="flex flex-wrap items-center gap-3 p-3 rounded-lg bg-muted/40 border text-xs">
          <span className="font-semibold text-foreground">
            {myPendingSheets.length} sheet{myPendingSheets.length !== 1 ? "s" : ""} pending
          </span>
          <span className="text-muted-foreground">·</span>
          <span className="text-emerald-600 font-medium">{approvedCount} approved</span>
          {returnedCount > 0 && (
            <>
              <span className="text-muted-foreground">·</span>
              <span className="text-amber-600 font-medium">{returnedCount} returned for rework</span>
            </>
          )}
          <div className="ml-auto">
            <Link
              to={ROUTES.MANAGER.TEAM_GOALS}
              className="flex items-center gap-0.5 text-indigo-600 hover:underline"
            >
              View all team goals <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search employee…"
            value={nameSearch}
            onChange={(e) => setNameSearch(e.target.value)}
            className="h-8 pl-8 text-xs w-44"
          />
        </div>

        {departments.length > 1 && (
          <select
            value={deptFilter}
            onChange={(e) => setDeptFilter(e.target.value)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="">All departments</option>
            {departments.map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        )}

        <Input
          type="date"
          title="Submitted from"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-8 text-xs w-36"
        />
        <Input
          type="date"
          title="Submitted to"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-8 text-xs w-36"
        />

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
          {["a", "b", "c"].map((k) => <Skeleton key={k} className="h-14 w-full rounded-lg" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState variant="no-approvals" className="py-12" />
      ) : (
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-semibold text-muted-foreground">Employee</th>
                <th className="text-left px-3 py-3 font-semibold text-muted-foreground hidden sm:table-cell">Department</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Goals</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground hidden md:table-cell">Submitted</th>
                <th className="text-right px-3 py-3 font-semibold text-muted-foreground">Days Waiting</th>
                <th className="text-center px-3 py-3 font-semibold text-muted-foreground">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((sheet) => (
                <tr
                  key={sheet.id}
                  className="border-b border-muted/30 hover:bg-muted/20 transition-colors"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-foreground">{sheet.userName}</p>
                    <p className="text-muted-foreground text-[10px]">{sheet.employeeCode}</p>
                  </td>
                  <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">
                    {sheet.departmentName}
                  </td>
                  <td className="px-3 py-3 text-right tabular-nums font-medium">
                    {sheet.goals.length}
                  </td>
                  <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">
                    {sheet.submittedAt
                      ? new Date(sheet.submittedAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })
                      : "—"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Badge
                      className={cn(
                        "text-[10px] font-semibold tabular-nums",
                        getDaysBadge(sheet.daysWaiting)
                      )}
                    >
                      {sheet.daysWaiting}d
                    </Badge>
                  </td>
                  <td className="px-3 py-3 text-center">
                    <GoalStatusBadge status={sheet.status} size="sm" />
                  </td>
                  <td className="px-4 py-3">
                    <Link to={ROUTES.MANAGER.REVIEW_SHEET(sheet.id)}>
                      <Button size="sm" className="h-7 text-xs whitespace-nowrap">
                        Review
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
