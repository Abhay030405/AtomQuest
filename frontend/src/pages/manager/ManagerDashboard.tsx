import { Link } from "react-router-dom";
import { differenceInDays, parseISO } from "date-fns";
import {
  Inbox,
  Users,
  CheckCircle2,
  CalendarDays,
  ChevronRight,
  Check,
  Clock,
  Pencil,
  Minus,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { EmptyState } from "@/components/shared/EmptyState";
import { usePendingApprovals } from "@/hooks/useGoals";
import { useDirectReports, useTeamSheets } from "@/hooks/useApprovals";
import { useAuth } from "@/hooks/useAuth";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { GoalStatus } from "@/types/goal.types";
import type { User } from "@/types/user.types";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getDaysColor(days: number): string {
  if (days > 7) return "text-red-600 font-semibold";
  if (days >= 3) return "text-amber-600 font-semibold";
  return "text-emerald-600";
}

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

// ─── Team member status ───────────────────────────────────────────────────────

type MemberStatus = "approved" | "submitted" | "drafting" | "not-started";

interface MemberStatusIconProps {
  readonly status: MemberStatus;
}

function MemberStatusIcon({ status }: MemberStatusIconProps) {
  if (status === "approved") {
    return (
      <div className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center shrink-0">
        <Check className="h-3 w-3" />
      </div>
    );
  }
  if (status === "submitted") {
    return (
      <div className="h-5 w-5 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
        <Clock className="h-3 w-3" />
      </div>
    );
  }
  if (status === "drafting") {
    return (
      <div className="h-5 w-5 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
        <Pencil className="h-3 w-3" />
      </div>
    );
  }
  return (
    <div className="h-5 w-5 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0">
      <Minus className="h-3 w-3" />
    </div>
  );
}

function getMemberStatusLabel(status: MemberStatus): string {
  if (status === "approved") return "Approved";
  if (status === "submitted") return "Pending review";
  if (status === "drafting") return "Drafting";
  return "Not started";
}

// ─── ManagerDashboard ─────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const { currentUser } = useAuth();
  const { data: pendingSheets = [], isLoading: pendingLoading } = usePendingApprovals();
  const { data: directReports = [], isLoading: reportsLoading } = useDirectReports();
  const { data: teamSheetsResponse, isLoading: sheetsLoading } = useTeamSheets(CYCLE_ID);

  const isLoading = pendingLoading || reportsLoading || sheetsLoading;
  const reportIds = directReports.map((u) => u.id);
  const teamSheets = teamSheetsResponse?.items.filter((s) => reportIds.includes(s.userId)) ?? [];
  const approvedCount = teamSheets.filter((s) => s.status === GoalStatus.APPROVED).length;
  const myPendingSheets = pendingSheets.filter((s) => reportIds.includes(s.userId));

  function getMemberStatus(member: User): MemberStatus {
    const sheet = teamSheets.find((s) => s.userId === member.id);
    if (!sheet) return "not-started";
    if (sheet.status === GoalStatus.APPROVED) return "approved";
    if (sheet.status === GoalStatus.SUBMITTED) return "submitted";
    return "drafting";
  }

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h1 className="text-xl font-semibold tracking-tight">
          {currentUser?.fullName
            ? `Welcome, ${currentUser.fullName.split(" ")[0]}`
            : "Manager Dashboard"}
        </h1>
        <p className="text-sm text-muted-foreground mt-0.5">FY 2026 · Goal Setting Phase</p>
      </div>

      {/* Metric cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MetricCard icon={Inbox} label="Pending Approvals" iconColor="text-red-500">
            <span className="text-lg">{myPendingSheets.length}</span>
            {myPendingSheets.length > 0 && (
              <Badge className="ml-2 bg-red-100 text-red-700 border border-red-200 text-[10px] px-1.5 py-0 font-medium">
                Needs action
              </Badge>
            )}
          </MetricCard>

          <MetricCard icon={Users} label="Team Size" iconColor="text-indigo-500">
            <span className="text-lg">{directReports.length}</span>
            <span className="text-muted-foreground font-normal text-xs"> direct reports</span>
          </MetricCard>

          <MetricCard icon={CheckCircle2} label="Approved This Cycle" iconColor="text-emerald-500">
            <span className="text-lg">{approvedCount}</span>
            <span className="text-muted-foreground font-normal"> / {directReports.length}</span>
          </MetricCard>

          <MetricCard icon={CalendarDays} label="Check-in Window" iconColor="text-amber-500">
            <span className="text-muted-foreground font-normal text-xs">Opens July 2026</span>
          </MetricCard>
        </div>
      )}

      {/* Body */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Approval Queue — 3/5 */}
        <div className="lg:col-span-3">
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Approval Queue</CardTitle>
                <Link
                  to={ROUTES.MANAGER.REVIEW}
                  className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </Link>
              </div>
            </CardHeader>
            <CardContent className="px-0 pb-2">
              {isLoading ? (
                <div className="space-y-2 px-4">
                  {["a", "b"].map((k) => <Skeleton key={k} className="h-12 w-full" />)}
                </div>
              ) : myPendingSheets.length === 0 ? (
                <EmptyState variant="no-approvals" className="py-8" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="text-left px-4 py-2.5 font-semibold text-muted-foreground">Employee</th>
                        <th className="text-left px-3 py-2.5 font-semibold text-muted-foreground hidden sm:table-cell">Dept</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Goals</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground hidden md:table-cell">Submitted</th>
                        <th className="text-right px-3 py-2.5 font-semibold text-muted-foreground">Waiting</th>
                        <th className="px-4 py-2.5" />
                      </tr>
                    </thead>
                    <tbody>
                      {myPendingSheets.map((sheet) => {
                        const user = USERS_BY_ID[sheet.userId];
                        const days = sheet.submittedAt
                          ? differenceInDays(new Date(), parseISO(sheet.submittedAt))
                          : 0;
                        return (
                          <tr
                            key={sheet.id}
                            className="border-b border-muted/30 hover:bg-muted/20 transition-colors"
                          >
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground">{user?.fullName ?? "—"}</p>
                              <p className="text-muted-foreground text-[10px]">{user?.employeeCode}</p>
                            </td>
                            <td className="px-3 py-3 text-muted-foreground hidden sm:table-cell">
                              {user?.departmentName ?? "—"}
                            </td>
                            <td className="px-3 py-3 text-right tabular-nums">{sheet.goals.length}</td>
                            <td className="px-3 py-3 text-right text-muted-foreground hidden md:table-cell">
                              {sheet.submittedAt
                                ? new Date(sheet.submittedAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                  })
                                : "—"}
                            </td>
                            <td className={cn("px-3 py-3 text-right tabular-nums", getDaysColor(days))}>
                              {days}d
                            </td>
                            <td className="px-4 py-3">
                              <Link to={ROUTES.MANAGER.REVIEW_SHEET(sheet.id)}>
                                <Button size="sm" className="h-7 text-xs">
                                  Review
                                </Button>
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-4 pt-3 pb-1">
                    <Link
                      to={ROUTES.MANAGER.TEAM_GOALS}
                      className="flex items-center gap-0.5 text-xs text-indigo-600 hover:underline"
                    >
                      View All Team Goals <ChevronRight className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Team Status — 2/5 */}
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-2 px-4 pt-4">
              <CardTitle className="text-sm font-semibold">Team Status</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {isLoading ? (
                <div className="space-y-3">
                  {["a", "b"].map((k) => <Skeleton key={k} className="h-10 w-full" />)}
                </div>
              ) : directReports.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No direct reports found.</p>
              ) : (
                <div className="space-y-1">
                  {directReports.map((member) => {
                    const memberStatus = getMemberStatus(member);
                    const sheet = teamSheets.find((s) => s.userId === member.id);
                    const linkTo = sheet && sheet.status === GoalStatus.SUBMITTED
                      ? ROUTES.MANAGER.REVIEW_SHEET(sheet.id)
                      : ROUTES.MANAGER.TEAM_GOALS;
                    return (
                      <Link
                        key={member.id}
                        to={linkTo}
                        className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 transition-colors group"
                      >
                        <MemberStatusIcon status={memberStatus} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate group-hover:text-indigo-600 transition-colors">
                            {member.fullName}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {getMemberStatusLabel(memberStatus)}
                          </p>
                        </div>
                        {sheet && <GoalStatusBadge status={sheet.status} size="sm" />}
                      </Link>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
