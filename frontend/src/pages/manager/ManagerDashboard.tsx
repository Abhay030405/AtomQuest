import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";
import { useDirectReports, useTeamSheets } from "@/hooks/useApprovals";
import { useCycleStore } from "@/store/cycleStore";

const STATUS_CHIP: Record<string, string> = {
  submitted: "bg-secondary-container text-on-secondary-container",
  approved: "bg-tertiary/10 text-tertiary",
  draft: "bg-surface-variant text-on-surface-variant",
  under_review: "bg-secondary-container text-on-secondary-container",
  rework: "bg-error/10 text-error",
};

export default function ManagerDashboard() {
  const { currentUser } = useAuthStore();
  const { activeConfig } = useCycleStore();
  const { data: directReports = [], isLoading: loadingReports } = useDirectReports();
  const { data: teamSheets = [], isLoading: loadingSheets } = useTeamSheets(activeConfig?.id ?? "");
  const userId = currentUser?.id ?? "";

  const pendingApprovals = teamSheets.filter((s: any) => s.status === "submitted" || s.status === "under_review").length;
  const reworkCount = teamSheets.filter((s: any) => s.status === "rework").length;
  const approvedCount = teamSheets.filter((s: any) => s.status === "approved").length;
  const completionPct = teamSheets.length > 0 ? Math.round((approvedCount / teamSheets.length) * 100) : 0;

  const quarterLabel = activeConfig?.name ?? "Current Quarter";

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-xl">
      {/* Header */}
      <div>
        <h2 className="text-headline-lg text-on-surface">Team Overview</h2>
        <p className="text-body-md text-on-surface-variant mt-sm">{quarterLabel} — Goal Setting & Performance</p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-gutter">
        {/* KPI cards — 8 cols */}
        <div className="col-span-1 md:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-md">
          {/* Pending approvals */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-level-1 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-title-md text-on-surface-variant">Pending Approvals</span>
              <span className="material-symbols-outlined text-primary bg-primary/10 p-sm rounded-full">fact_check</span>
            </div>
            <div className="mt-xl">
              <span className="text-display-lg text-on-surface">{loadingSheets ? "—" : pendingApprovals}</span>
              <p className="text-label-md text-error flex items-center mt-xs">
                <span className="material-symbols-outlined text-[16px] mr-1">trending_up</span>
                Requires attention
              </p>
            </div>
          </div>

          {/* Team completion */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-level-1 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-title-md text-on-surface-variant">Team Completion</span>
              <span className="material-symbols-outlined text-tertiary bg-tertiary/10 p-sm rounded-full">donut_large</span>
            </div>
            <div className="mt-xl">
              <span className="text-display-lg text-on-surface">{completionPct}%</span>
              <div className="w-full bg-surface-variant rounded-full h-2 mt-2">
                <div className="bg-tertiary h-2 rounded-full transition-all" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
          </div>

          {/* Rework required */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-level-1 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-title-md text-on-surface-variant">Rework Required</span>
              <span className="material-symbols-outlined text-error bg-error/10 p-sm rounded-full">published_with_changes</span>
            </div>
            <div className="mt-xl">
              <span className="text-display-lg text-on-surface">{loadingSheets ? "—" : reworkCount}</span>
              <p className="text-label-md text-secondary flex items-center mt-xs">Needs attention today</p>
            </div>
          </div>
        </div>

        {/* Deadline progress donut — 4 cols */}
        <div className="col-span-1 md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-level-1 flex flex-col">
          <div className="border-b border-outline-variant pb-sm mb-md flex justify-between items-center">
            <h3 className="text-title-md text-on-surface">Deadline Progress</h3>
            <span className="material-symbols-outlined text-on-surface-variant text-[20px]">more_vert</span>
          </div>
          <div className="flex-1 flex flex-col items-center justify-center relative min-h-[200px]">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
              <path className="text-surface-variant" fill="none" stroke="currentColor" strokeWidth="3"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
              <path className="text-primary" fill="none" stroke="currentColor" strokeWidth="3"
                strokeDasharray={`${completionPct}, 100`}
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className="text-title-lg font-bold">{completionPct}%</span>
              <span className="text-label-md text-on-surface-variant">Complete</span>
            </div>
          </div>
        </div>

        {/* Team progress table — 8 cols */}
        <div className="col-span-1 md:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-level-1 flex flex-col overflow-hidden">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-container-lowest">
            <h3 className="text-title-md text-on-surface">Team Progress</h3>
            <button className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded flex items-center hover:bg-surface-container-low transition-colors shadow-level-1">
              <span className="material-symbols-outlined text-[18px] mr-sm">filter_list</span> Filter
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface-container text-label-md text-on-surface-variant uppercase border-b border-outline-variant">
                <tr>
                  <th className="p-md font-medium whitespace-nowrap sticky left-0 bg-surface-container z-10">Employee</th>
                  <th className="p-md font-medium whitespace-nowrap">Role</th>
                  <th className="p-md font-medium whitespace-nowrap">Status</th>
                  <th className="p-md font-medium whitespace-nowrap text-right">Action</th>
                </tr>
              </thead>
              <tbody className="text-body-md divide-y divide-outline-variant">
                {loadingReports ? (
                  <tr><td colSpan={4} className="p-lg text-center text-on-surface-variant">Loading...</td></tr>
                ) : directReports.length === 0 ? (
                  <tr><td colSpan={4} className="p-lg text-center text-on-surface-variant">No direct reports found</td></tr>
                ) : (
                  directReports.slice(0, 6).map((report: any) => {
                    const sheet = teamSheets.find((s: any) => s.employeeId === report.id);
                    const status = sheet?.status ?? "draft";
                    const chipClass = STATUS_CHIP[status] ?? "bg-surface-variant text-on-surface-variant";
                    const initials = (report.fullName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                    return (
                      <tr key={report.id} className="hover:bg-surface-container-low transition-colors">
                        <td className="p-md sticky left-0 bg-surface-container-lowest z-10 flex items-center gap-md">
                          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-title-md">{initials}</div>
                          <span className="font-medium">{report.fullName}</span>
                        </td>
                        <td className="p-md text-on-surface-variant">{report.departmentName ?? "—"}</td>
                        <td className="p-md">
                          <span className={`inline-flex items-center px-2 py-1 rounded-full text-label-md font-medium ${chipClass}`}>
                            {status.replace(/_/g, " ").replace(/\b\w/g, (c: string) => c.toUpperCase())}
                          </span>
                        </td>
                        <td className="p-md text-right">
                          {sheet ? (
                            <Link
                              to={ROUTES.MANAGER.REVIEW(userId)}
                              className="bg-primary text-on-primary text-label-md px-md py-sm rounded shadow-level-1 border-t border-white/20 hover:opacity-90 transition-colors"
                            >
                              Review
                            </Link>
                          ) : (
                            <button className="text-secondary hover:bg-surface-variant p-sm rounded text-label-md transition-colors">
                              Nudge
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          <div className="p-md border-t border-outline-variant bg-surface-container-lowest flex justify-center">
            <Link to={ROUTES.MANAGER.TEAM_GOALS(userId)} className="text-primary text-label-md hover:underline">
              View All Direct Reports
            </Link>
          </div>
        </div>

        {/* Recent activity — 4 cols */}
        <div className="col-span-1 md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-lg p-lg shadow-level-1 flex flex-col h-full">
          <div className="border-b border-outline-variant pb-sm mb-md">
            <h3 className="text-title-md text-on-surface">Recent Activity</h3>
          </div>
          <div className="flex-1 overflow-y-auto space-y-md">
            <div className="flex gap-md">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-secondary-container flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-[16px] text-on-secondary-container">upload_file</span>
                </div>
                <div className="w-px flex-1 bg-outline-variant my-1" />
              </div>
              <div className="pb-md">
                <p className="text-body-md text-on-surface">Team member submitted goals for review.</p>
                <p className="text-label-md text-on-surface-variant mt-xs">2 hours ago</p>
              </div>
            </div>
            <div className="flex gap-md">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-[16px] text-tertiary">check_circle</span>
                </div>
                <div className="w-px flex-1 bg-outline-variant my-1" />
              </div>
              <div className="pb-md">
                <p className="text-body-md text-on-surface">Goal sheet approved successfully.</p>
                <p className="text-label-md text-on-surface-variant mt-xs">Yesterday</p>
              </div>
            </div>
            <div className="flex gap-md">
              <div className="flex flex-col items-center">
                <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center z-10">
                  <span className="material-symbols-outlined text-[16px] text-error">assignment_return</span>
                </div>
              </div>
              <div className="pb-md">
                <p className="text-body-md text-on-surface">Feedback requested on submitted goals.</p>
                <p className="text-label-md text-on-surface-variant mt-xs">Yesterday</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
