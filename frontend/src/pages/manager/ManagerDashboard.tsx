import { Link } from "react-router-dom";
import { useMemo } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCycleStore } from "@/store/cycleStore";
import { ROUTES } from "@/constants/routes";
import { useDirectReports, useTeamSheets } from "@/hooks/useApprovals";
import { GoalStatus } from "@/types/goal.types";
import { timeAgo } from "@/utils/date.util";

// Sheet status → chip styling + label
const SHEET_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  [GoalStatus.DRAFT]:     { cls: "bg-surface-variant text-on-surface-variant",           label: "Draft" },
  [GoalStatus.SUBMITTED]: { cls: "bg-secondary-container text-on-secondary-container",   label: "Submitted" },
  [GoalStatus.APPROVED]:  { cls: "bg-tertiary-container/40 text-tertiary",               label: "Approved" },
};

// Sheet → "recent update" presentation
function sheetUpdateMeta(status: string): { icon: string; cls: string; label: string } {
  switch (status) {
    case GoalStatus.SUBMITTED:
      return { icon: "hourglass_top", cls: "bg-secondary-container text-on-secondary-container", label: "Submitted for review" };
    case GoalStatus.APPROVED:
      return { icon: "check_circle",  cls: "bg-tertiary-container text-on-tertiary-container",   label: "Goal sheet approved" };
    case GoalStatus.DRAFT:
      return { icon: "edit_note",     cls: "bg-surface-variant text-on-surface-variant",         label: "Draft updated" };
    default:
      return { icon: "comment",       cls: "bg-surface-variant text-on-surface-variant",         label: status };
  }
}

interface RecentUpdate {
  id: string;
  employeeName: string;
  sheetId: string;
  status: string;
  at: string;
}

export default function ManagerDashboard() {
  const { currentUser } = useAuthStore();
  const { activeWindow } = useCycleStore();
  const { data: directReports = [], isLoading: loadingReports } = useDirectReports();
  const { data: teamSheets = [], isLoading: loadingSheets } = useTeamSheets(activeWindow?.id ?? "");

  const userId = currentUser?.id ?? "";
  const firstName = currentUser?.fullName?.split(" ")[0] ?? "there";
  const quarterLabel = activeWindow?.cycleName ?? "Current Cycle";

  // Index sheets by employee user id (sheets carry userId, NOT employeeId)
  const sheetByUser = useMemo(() => {
    const m = new Map<string, any>();
    for (const s of teamSheets as any[]) m.set(s.userId, s);
    return m;
  }, [teamSheets]);

  // Aggregate stats from sheets (status uses GoalSheetStatus values: draft|submitted|approved)
  const stats = useMemo(() => {
    const pending = (teamSheets as any[]).filter((s) => s.status === GoalStatus.SUBMITTED).length;
    const approved = (teamSheets as any[]).filter((s) => s.status === GoalStatus.APPROVED).length;
    const draft = (teamSheets as any[]).filter((s) => s.status === GoalStatus.DRAFT).length;
    const total = teamSheets.length;
    const completionPct = total > 0 ? Math.round((approved / total) * 100) : 0;
    return { pending, approved, draft, total, completionPct };
  }, [teamSheets]);

  // Recent updates: build a feed from sheets (approvedAt or submittedAt), newest first.
  const recentUpdates: RecentUpdate[] = useMemo(() => {
    const reportNameById = new Map<string, string>(
      (directReports as any[]).map((u) => [u.id, u.fullName])
    );
    const items: RecentUpdate[] = [];
    for (const s of teamSheets as any[]) {
      if (s.approvedAt) {
        items.push({
          id: `${s.id}-approved`,
          employeeName: s.employeeName ?? reportNameById.get(s.userId) ?? "Unknown",
          sheetId: s.id,
          status: GoalStatus.APPROVED,
          at: s.approvedAt,
        });
      }
      if (s.submittedAt) {
        items.push({
          id: `${s.id}-submitted`,
          employeeName: s.employeeName ?? reportNameById.get(s.userId) ?? "Unknown",
          sheetId: s.id,
          status: GoalStatus.SUBMITTED,
          at: s.submittedAt,
        });
      }
    }
    return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()).slice(0, 8);
  }, [teamSheets, directReports]);

  const isLoading = loadingReports || loadingSheets;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="mb-lg flex flex-col sm:flex-row sm:items-end justify-between gap-md shrink-0">
        <div>
          <h2 className="text-headline-lg-mobile md:text-headline-lg text-on-surface mb-xs">
            Welcome back, {firstName}
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            {quarterLabel} — manage your team's goal sheets and approvals.
          </p>
        </div>

      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-lg flex-1 min-h-0">
        {/* Status summary — 8 cols */}
        <div className="col-span-1 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-md content-start">
          {/* Pending approvals */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary-container" />
            <div className="flex flex-col pl-xs min-w-0">
              <span className="text-label-lg text-on-surface-variant truncate">Pending Approvals</span>
              <span className="text-headline-md text-on-surface leading-tight">{isLoading ? "—" : stats.pending}</span>
              {stats.pending > 0 && (
                <span className="text-label-sm text-error flex items-center gap-xs mt-xs">
                  <span className="material-symbols-outlined text-[14px]">warning</span>
                  Awaiting your review
                </span>
              )}
            </div>
            <span className="material-symbols-outlined text-on-secondary-container/70 text-[28px] shrink-0">fact_check</span>
          </div>

          {/* Team completion */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-tertiary-container" />
            <div className="flex flex-col pl-xs min-w-0 flex-1">
              <span className="text-label-lg text-on-surface-variant truncate">Team Completion</span>
              <span className="text-headline-md text-on-surface leading-tight">{isLoading ? "—" : `${stats.completionPct}%`}</span>
              <div className="w-full bg-surface-container-high rounded-full h-1.5 mt-xs">
                <div
                  className="bg-tertiary h-1.5 rounded-full transition-all"
                  style={{ width: `${stats.completionPct}%` }}
                />
              </div>
            </div>
            <span className="material-symbols-outlined text-on-tertiary-container/70 text-[28px] shrink-0">donut_large</span>
          </div>

          {/* Drafts */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-surface-variant" />
            <div className="flex flex-col pl-xs min-w-0">
              <span className="text-label-lg text-on-surface-variant truncate">Drafts in Progress</span>
              <span className="text-headline-md text-on-surface leading-tight">{isLoading ? "—" : stats.draft}</span>
              <span className="text-label-sm text-on-surface-variant mt-xs">Not yet submitted</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/70 text-[28px] shrink-0">edit_document</span>
          </div>
        </div>

        {/* Recent updates — 4 cols, full height (spans 2 rows) */}
        <div className="col-span-1 lg:col-span-4 lg:row-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 flex flex-col h-full min-h-[320px]">
          <div className="p-md border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-title-md text-on-surface">Recent Updates</h3>
            <span className="text-label-md text-on-surface-variant">{recentUpdates.length}</span>
          </div>
          <div className="p-md flex flex-col gap-md flex-1 overflow-y-auto">
            {isLoading ? (
              [1, 2, 3, 4].map((i) => (
                <div key={i} className="flex gap-md items-start animate-pulse">
                  <div className="w-8 h-8 rounded-full bg-surface-container-high shrink-0" />
                  <div className="flex-1 space-y-1">
                    <div className="h-3 bg-surface-container-high rounded w-3/4" />
                    <div className="h-2 bg-surface-container-high rounded w-1/2" />
                  </div>
                </div>
              ))
            ) : recentUpdates.length === 0 ? (
              <p className="text-body-md text-on-surface-variant text-center py-4">No recent updates</p>
            ) : (
              recentUpdates.map((u) => {
                const { icon, cls, label } = sheetUpdateMeta(u.status);
                return (
                  <Link
                    key={u.id}
                    to={ROUTES.MANAGER.REVIEW_SHEET(userId, u.sheetId)}
                    className="flex gap-md items-start hover:bg-surface-container-low rounded-md p-1 -m-1 transition-colors"
                  >
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cls}`}>
                      <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-body-md text-on-surface truncate">{u.employeeName}</p>
                      <p className="text-label-md text-on-surface-variant mt-xs">
                        {label} · {timeAgo(u.at)}
                      </p>
                    </div>
                  </Link>
                );
              })
            )}
          </div>
        </div>

        {/* Team progress — 8 cols (sits beneath stats, beside Recent Updates) */}
        <div className="col-span-1 lg:col-span-8 min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-md shrink-0">
            <h3 className="text-title-lg text-on-surface">Team Progress</h3>
            <Link
              to={ROUTES.MANAGER.TEAM_GOALS(userId)}
              className="text-title-md text-primary hover:underline flex items-center gap-1"
            >
              View All <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
            {(() => {
              if (isLoading) {
                return (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 h-28 animate-pulse" />
                    ))}
                  </div>
                );
              }
              if (directReports.length === 0) {
                return (
                  <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-level-1 text-center">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">group_off</span>
                    <p className="text-body-lg text-on-surface-variant mt-md">No direct reports found.</p>
                  </div>
                );
              }
              return (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-md auto-rows-min">
                  {(directReports as any[]).map((report) => {
                    const sheet = sheetByUser.get(report.id);
                    const status = sheet?.status ?? GoalStatus.DRAFT;
                    const chip = SHEET_STATUS_CHIP[status] ?? SHEET_STATUS_CHIP[GoalStatus.DRAFT];
                    const initials = (report.fullName ?? "??")
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase();
                    const goalCount = sheet?.goals?.length ?? 0;
                    const totalWeight = Number(sheet?.totalWeightage ?? 0);
                    return (
                      <div
                        key={report.id}
                        className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 hover:shadow-level-2 transition-shadow flex flex-col gap-sm"
                      >
                        {/* Header row */}
                        <div className="flex items-center gap-sm">
                          <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-semibold shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-title-sm text-on-surface truncate leading-tight">{report.fullName}</p>
                            <p className="text-label-md text-on-surface-variant truncate leading-tight">
                              {report.departmentName ?? "—"}
                            </p>
                          </div>
                          <span className={`shrink-0 inline-flex items-center px-2 py-0.5 rounded text-label-sm uppercase tracking-wider ${chip.cls}`}>
                            {chip.label}
                          </span>
                        </div>

                        {/* Stats row */}
                        <div className="flex items-center justify-between text-label-md">
                          <span className="inline-flex items-center gap-1 text-on-surface-variant">
                            <span className="material-symbols-outlined text-[14px] leading-none">flag</span>
                            {goalCount} goal{goalCount === 1 ? "" : "s"}
                          </span>
                          <span className={`tabular-nums font-semibold ${totalWeight === 100 ? "text-tertiary" : "text-on-surface-variant"}`}>
                            {totalWeight}% weightage
                          </span>
                        </div>

                        {/* Weightage progress */}
                        <div className="w-full bg-surface-container-high rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${totalWeight === 100 ? "bg-tertiary" : "bg-primary"}`}
                            style={{ width: `${Math.min(totalWeight, 100)}%` }}
                          />
                        </div>

                        {/* Action row */}
                        <div className="flex items-center justify-between gap-sm mt-xs">
                          <span className="text-label-md text-on-surface-variant">
                            {sheet?.submittedAt
                              ? `Submitted ${timeAgo(sheet.submittedAt)}`
                              : "No submission yet"}
                          </span>
                          {sheet && status === GoalStatus.SUBMITTED ? (
                            <Link
                              to={ROUTES.MANAGER.REVIEW_SHEET(userId, sheet.id)}
                              className="bg-primary text-on-primary text-label-md px-sm py-1 rounded shadow-level-1 border-t border-white/20 hover:opacity-90 transition-colors"
                            >
                              Review
                            </Link>
                          ) : sheet ? (
                            <Link
                              to={ROUTES.MANAGER.REVIEW_SHEET(userId, sheet.id)}
                              className="text-primary text-label-md hover:underline"
                            >
                              View
                            </Link>
                          ) : (
                            <span className="text-label-md text-on-surface-variant italic">Awaiting draft</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    </div>
  );
}
