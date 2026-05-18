import { Link } from "react-router-dom";
import { useOrgStats, useAdminAuditLog, useAdminAllSheets } from "@/hooks/useAdmin";
import { useAuth } from "@/hooks/useAuth";
import { useCycleStore } from "@/store/cycleStore";
import { ROUTES } from "@/constants/routes";
import { timeAgo } from "@/utils/date.util";
import { getRoleDisplayName } from "@/utils/permission.util";
import { AuditAction } from "@/types/audit.types";
import { GoalStatus } from "@/types/goal.types";
import { cn } from "@/lib/utils";

const DEPT_COMPLIANCE = [
  { name: "Engineering", pct: 92 },
  { name: "Sales", pct: 85 },
  { name: "Marketing", pct: 76 },
  { name: "Human Resources", pct: 98 },
  { name: "Operations", pct: 60 },
];

export default function AdminDashboard() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? "";
  const cycleId = useCycleStore((s) => s.activeWindow?.id ?? "");
  const { data: stats, isLoading: statsLoading } = useOrgStats();
  const { data: auditPage, isLoading: auditLoading } = useAdminAuditLog({ pageSize: 6 });
  const { data: allSheetsRes, isLoading: sheetsLoading } = useAdminAllSheets(cycleId);

  const isLoading = statsLoading || auditLoading || sheetsLoading;
  void allSheetsRes;
  const recentLogs = auditPage?.items ?? [];

  const submissionRate = stats?.totalUsers
    ? Math.round(((stats.sheetsByStatus?.[GoalStatus.SUBMITTED] ?? 0) + (stats.sheetsByStatus?.[GoalStatus.APPROVED] ?? 0)) / stats.totalUsers * 100)
    : 0;
  const managerCompletion = stats?.totalUsers
    ? Math.round((stats.sheetsByStatus?.[GoalStatus.APPROVED] ?? 0) / Math.max(1, stats.totalUsers) * 100)
    : 0;
  const pendingApprovals = stats?.sheetsByStatus?.[GoalStatus.SUBMITTED] ?? 0;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-xl">
      {/* Header */}
      <div>
        <h2 className="text-headline-lg-mobile md:text-headline-lg text-on-surface">Dashboard Overview</h2>
        <p className="text-body-lg text-on-surface-variant mt-xs">High-level metrics and system health for global HR operations.</p>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-md">
        {/* Total Employees */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-level-1 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-md">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Total Employees</span>
            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-[20px]">group</span>
            </div>
          </div>
          <div>
            <div className="text-display-lg text-on-surface">{isLoading ? "—" : (stats?.totalUsers ?? 0)}</div>
            <div className="flex items-center mt-xs text-tertiary">
              <span className="material-symbols-outlined text-[16px] mr-xs">trending_up</span>
              <span className="text-label-md">+2.4% this quarter</span>
            </div>
          </div>
        </div>

        {/* Submission Rate */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-level-1 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-md">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Submission Rate</span>
            <div className="w-8 h-8 rounded-full bg-tertiary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-tertiary text-[20px]">assignment_turned_in</span>
            </div>
          </div>
          <div>
            <div className="text-display-lg text-on-surface">{isLoading ? "—" : `${submissionRate}%`}</div>
            <div className="w-full bg-surface-container-high h-2 rounded-full mt-sm overflow-hidden">
              <div className="bg-tertiary h-full rounded-full transition-all" style={{ width: `${submissionRate}%` }} />
            </div>
          </div>
        </div>

        {/* Manager Completion */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-level-1 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-md">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Manager Completion</span>
            <div className="w-8 h-8 rounded-full bg-secondary/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-secondary text-[20px]">supervisor_account</span>
            </div>
          </div>
          <div>
            <div className="text-display-lg text-on-surface">{isLoading ? "—" : `${managerCompletion}%`}</div>
            <div className="w-full bg-surface-container-high h-2 rounded-full mt-sm overflow-hidden">
              <div className="bg-secondary h-full rounded-full transition-all" style={{ width: `${managerCompletion}%` }} />
            </div>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-level-1 flex flex-col justify-between">
          <div className="flex justify-between items-start mb-md">
            <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Pending Approvals</span>
            <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center">
              <span className="material-symbols-outlined text-error text-[20px]">pending_actions</span>
            </div>
          </div>
          <div>
            <div className="text-display-lg text-on-surface">{isLoading ? "—" : pendingApprovals}</div>
            <div className="flex items-center mt-xs text-error">
              <span className="material-symbols-outlined text-[16px] mr-xs">warning</span>
              <span className="text-label-md">Requires attention</span>
            </div>
          </div>
        </div>
      </div>

      {/* Secondary grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Org compliance chart */}
        <div className="lg:col-span-2 bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1 flex flex-col">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-title-lg text-on-surface">Organizational Compliance</h3>
            <button className="text-on-surface-variant hover:bg-surface-container-low p-xs rounded transition-colors">
              <span className="material-symbols-outlined">more_vert</span>
            </button>
          </div>
          <div className="p-lg flex-1">
            <p className="text-body-md text-on-surface-variant mb-md">Goal-setting progress by department</p>
            <div className="space-y-md">
              {DEPT_COMPLIANCE.map((dept) => (
                <div key={dept.name}>
                  <div className="flex justify-between text-label-md mb-xs">
                    <span className="text-on-surface">{dept.name}</span>
                    <span className="text-on-surface-variant">{dept.pct}%</span>
                  </div>
                  <div className="w-full bg-surface-container-high h-4 rounded-sm overflow-hidden">
                    <div
                      className={cn("h-full rounded-sm transition-all", dept.pct >= 80 ? "bg-primary" : "bg-secondary")}
                      style={{ width: `${dept.pct}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* System health + governance */}
        <div className="flex flex-col gap-lg">
          {/* System health */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1">
            <div className="p-lg border-b border-outline-variant">
              <h3 className="text-title-lg text-on-surface">System Health</h3>
            </div>
            <div className="p-lg">
              <div className="bg-primary-fixed/30 border border-primary-fixed-dim rounded-lg p-md flex items-start gap-md">
                <span className="material-symbols-outlined text-primary mt-xs">event_available</span>
                <div>
                  <h4 className="text-title-md text-on-surface">Q3 2024 Goal Setting</h4>
                  <p className="text-body-md text-on-surface-variant mt-xs">Current active window.</p>
                  <div className="mt-md inline-flex items-center px-sm py-xs bg-tertiary/10 text-tertiary rounded text-label-md">
                    <span className="w-2 h-2 rounded-full bg-tertiary mr-xs"></span>
                    Active
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Governance alerts */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1 flex-1">
            <div className="p-lg border-b border-outline-variant flex justify-between items-center">
              <h3 className="text-title-lg text-on-surface">Governance Alerts</h3>
              <span className="bg-error/10 text-error px-sm py-xs rounded text-label-md">2 New</span>
            </div>
            <ul className="divide-y divide-outline-variant">
              <li className="p-md hover:bg-surface-container-low transition-colors flex items-start gap-md">
                <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center text-error shrink-0 mt-xs">
                  <span className="material-symbols-outlined text-[18px]">gavel</span>
                </div>
                <div>
                  <p className="text-body-md text-on-surface font-medium">Compliance Audit Overdue</p>
                  <p className="text-label-md text-on-surface-variant mt-xs">EMEA Region - Needs immediate action.</p>
                  <span className="text-label-md text-outline mt-xs block">2 hours ago</span>
                </div>
              </li>
              <li className="p-md hover:bg-surface-container-low transition-colors flex items-start gap-md">
                <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0 mt-xs">
                  <span className="material-symbols-outlined text-[18px]">manage_accounts</span>
                </div>
                <div>
                  <p className="text-body-md text-on-surface font-medium">Bulk Role Assignment</p>
                  <p className="text-label-md text-on-surface-variant mt-xs">System generated - 50+ users modified.</p>
                  <span className="text-label-md text-outline mt-xs block">Yesterday</span>
                </div>
              </li>
            </ul>
            <div className="p-sm border-t border-outline-variant text-center">
              <Link to={ROUTES.ADMIN.AUDIT(userId)} className="text-primary hover:underline text-label-md font-medium transition-colors">
                View All Logs
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Recent audit log preview */}
      {!auditLoading && recentLogs.length > 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1 overflow-hidden">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-bright">
            <div>
              <h3 className="text-title-lg text-on-surface">Recent Activity</h3>
              <p className="text-label-md text-on-surface-variant">System modifications and access trail</p>
            </div>
            <Link to={ROUTES.ADMIN.AUDIT(userId)} className="text-primary text-label-md font-medium hover:underline">
              View Full Log
            </Link>
          </div>
          <div className="divide-y divide-outline-variant/50">
            {recentLogs.slice(0, 5).map((log) => {
              const isInsert = log.action === AuditAction.INSERT;
              const isDelete = log.action === AuditAction.DELETE;
              const dotColor = isInsert ? "bg-tertiary" : isDelete ? "bg-error" : "bg-secondary";
              return (
                <div key={log.id} className="p-md hover:bg-surface-container-low transition-colors flex items-start gap-md">
                  <div className={cn("w-2 h-2 rounded-full mt-2 shrink-0", dotColor)} />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md text-on-surface">
                      <span className="font-medium">{log.actorName}</span>
                      {" "}
                      <span className="text-on-surface-variant">({getRoleDisplayName(log.actorRole)})</span>
                      {" "}{log.action.toLowerCase()}d{" "}
                      <span className="font-code text-[11px] bg-surface-container px-xs rounded">{log.tableName}</span>
                    </p>
                    <p className="text-label-md text-on-surface-variant mt-xs">{timeAgo(log.changedAt)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
