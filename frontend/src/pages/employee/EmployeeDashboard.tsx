import { Link } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCycleStore } from "@/store/cycleStore";
import { ROUTES } from "@/constants/routes";
import { useMyGoals, useMySheet } from "@/hooks/useGoals";
import { timeAgo } from "@/utils/date.util";

function statusChip(status: string) {
  const map: Record<string, string> = {
    approved: "bg-tertiary-container/10 text-tertiary-container",
    submitted: "bg-secondary-container text-on-secondary-container",
    draft: "bg-surface-variant text-on-surface-variant",
    locked: "bg-primary/10 text-primary",
    under_review: "bg-secondary-container text-on-secondary-container",
    archived: "bg-surface-variant text-on-surface-variant",
  };
  return map[status] ?? "bg-surface-variant text-on-surface-variant";
}

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function updateMeta(status: string) {
  switch (status) {
    case "submitted":
    case "under-review":
      return {
        icon: "hourglass_top",
        cls: "bg-secondary-container text-on-secondary-container",
        label: "Submitted for review",
      };
    case "approved":
      return {
        icon: "check_circle",
        cls: "bg-tertiary-container text-on-tertiary-container",
        label: "Approved by manager",
      };
    case "locked":
      return {
        icon: "lock",
        cls: "bg-primary/10 text-primary",
        label: "Locked for cycle",
      };
    case "draft":
      return {
        icon: "edit_note",
        cls: "bg-surface-variant text-on-surface-variant",
        label: "Draft updated",
      };
    default:
      return {
        icon: "comment",
        cls: "bg-surface-variant text-on-surface-variant",
        label: statusLabel(status),
      };
  }
}

export default function EmployeeDashboard() {
  const { currentUser } = useAuthStore();
  const activeWindow = useCycleStore((s) => s.activeWindow);
  const { data: goals = [], isLoading } = useMyGoals(activeWindow?.id);
  const { data: sheet } = useMySheet(activeWindow?.id ?? "");

  const firstName = currentUser?.fullName?.split(" ")[0] ?? "there";
  const userId = currentUser?.id ?? "";

  // ── Sheet status notification (approved / rejected / admin-unlocked) ──
  const rejectedFeedback = goals
    .filter((g) => g.status === "draft" && Boolean((g as { managerComment?: string }).managerComment))
    .map((g) => ({ id: g.id, title: g.title, comment: (g as { managerComment?: string }).managerComment ?? "" }));

  type Banner = {
    kind: "approved" | "rejected" | "unlocked";
    accent: string;
    border: string;
    bg: string;
    pillBg: string;
    pillText: string;
    icon: string;
    pillLabel: string;
    description: string;
  };

  let banner: Banner | null = null;
  if (sheet?.status === "approved") {
    banner = {
      kind: "approved",
      accent: "bg-emerald-500",
      border: "border-emerald-300",
      bg: "bg-emerald-50",
      pillBg: "bg-emerald-100",
      pillText: "text-emerald-800",
      icon: "check_circle",
      pillLabel: "Approved",
      description: "Your manager has approved this goal sheet. Goals are now locked for the cycle.",
    };
  } else if (rejectedFeedback.length > 0) {
    banner = {
      kind: "rejected",
      accent: "bg-red-500",
      border: "border-red-300",
      bg: "bg-red-50",
      pillBg: "bg-red-100",
      pillText: "text-red-800",
      icon: "error",
      pillLabel: "Rework Required",
      description: "Your manager has returned the following goals with feedback. Edit and resubmit.",
    };
  } else if (sheet?.status === "draft" && (sheet?.returnedCount ?? 0) > 0) {
    banner = {
      kind: "unlocked",
      accent: "bg-amber-500",
      border: "border-amber-300",
      bg: "bg-amber-50",
      pillBg: "bg-amber-100",
      pillText: "text-amber-900",
      icon: "lock_open_right",
      pillLabel: "Unlocked by Admin",
      description: "An administrator has unlocked your approved goal sheet. You can edit and resubmit your goals.",
    };
  }

  const sheetTitle = activeWindow?.cycleName ?? "Current Performance Objectives";

  const draft = goals.filter((g) => g.status === "draft").length;
  const pending = goals.filter((g) => ["submitted", "under-review"].includes(g.status)).length;
  const approved = goals.filter((g) => ["approved", "locked"].includes(g.status)).length;
  const activeGoals = goals.filter((g) => ["approved", "locked", "submitted", "under-review", "draft"].includes(g.status));

  // Recent updates derived from the user's own goals (sorted by updatedAt desc)
  const recentUpdates = [...goals]
    .filter((g) => Boolean(g.updatedAt))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 5);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full h-full flex flex-col overflow-hidden">
      {/* Page header */}
      <div className="mb-lg flex flex-col sm:flex-row sm:items-end justify-between gap-md shrink-0">
        <div>
          <h2 className="text-headline-lg-mobile md:text-headline-lg text-on-surface mb-xs">
            Welcome back, {firstName}
          </h2>
          <p className="text-body-lg text-on-surface-variant">
            Here is an overview of your current performance objectives.
          </p>
        </div>
        <Link
          to={ROUTES.EMPLOYEE.GOALS(userId)}
          className="inline-flex items-center gap-sm bg-primary text-on-primary rounded-lg py-2 px-md text-title-md border-t border-white/20 shadow-level-1 hover:opacity-90 transition-all self-start"
        >
          <span className="material-symbols-outlined text-[18px]">add_circle</span>
          Create New Goal Sheet
        </Link>
      </div>

      {/* Sheet-status notification banner */}
      {banner && (
        <div
          className={`mb-lg shrink-0 rounded-xl border-2 ${banner.border} ${banner.bg} shadow-level-1 overflow-hidden`}
          role="status"
          aria-live="polite"
        >
          <div className={`h-1.5 ${banner.accent}`} />
          <div className="p-md flex flex-col gap-md">
            <div className="flex flex-wrap items-center justify-between gap-md">
              <div className="flex flex-col gap-xs min-w-0">
                <span className={`inline-flex items-center gap-1.5 self-start px-2 py-1 rounded-full text-label-md font-semibold ${banner.pillBg} ${banner.pillText}`}>
                  <span className="material-symbols-outlined text-[16px] leading-none">{banner.icon}</span>
                  {banner.pillLabel}
                </span>
                <h3 className="text-title-lg text-on-surface">{sheetTitle} — Performance Objectives</h3>
                <p className="text-body-md text-on-surface-variant">{banner.description}</p>
              </div>
              {(banner.kind === "rejected" || banner.kind === "unlocked") && (
                <Link
                  to={ROUTES.EMPLOYEE.GOALS(userId)}
                  className="inline-flex items-center gap-sm bg-primary text-on-primary rounded-lg py-2 px-md text-title-md border-t border-white/20 shadow-level-1 hover:opacity-90 transition-all self-start"
                >
                  <span className="material-symbols-outlined text-[18px]">edit</span>
                  Edit Goals
                </Link>
              )}
            </div>

            {banner.kind === "rejected" && rejectedFeedback.length > 0 && (
              <div className="bg-surface-container-lowest border border-red-200 rounded-lg max-h-56 overflow-y-auto divide-y divide-red-100">
                {rejectedFeedback.map((item) => (
                  <div key={item.id} className="p-sm flex flex-col gap-xs">
                    <div className="flex items-start gap-xs">
                      <span className="text-label-md font-semibold text-on-surface-variant shrink-0">Title:</span>
                      <span className="text-body-md text-on-surface">{item.title}</span>
                    </div>
                    <div className="flex items-start gap-xs">
                      <span className="text-label-md font-semibold text-on-surface-variant shrink-0">Feedback:</span>
                      <span className="text-body-md text-on-surface italic">“{item.comment}”</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Bento grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 lg:grid-rows-[auto_1fr] gap-lg flex-1 min-h-0">
        {/* Status summary — 8 cols */}
        <div className="col-span-1 lg:col-span-8 grid grid-cols-1 sm:grid-cols-3 gap-md content-start">
          {/* Draft */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-surface-variant" />
            <div className="flex flex-col pl-xs min-w-0">
              <span className="text-label-lg text-on-surface-variant truncate">Draft Goals</span>
              <span className="text-headline-md text-on-surface leading-tight">{isLoading ? "—" : draft}</span>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant/70 text-[28px] shrink-0">edit_document</span>
          </div>
          {/* Pending */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-secondary-container" />
            <div className="flex flex-col pl-xs min-w-0">
              <span className="text-label-lg text-on-surface-variant truncate">Pending Review</span>
              <span className="text-headline-md text-on-surface leading-tight">{isLoading ? "—" : pending}</span>
            </div>
            <span className="material-symbols-outlined text-on-secondary-container/70 text-[28px] shrink-0">hourglass_empty</span>
          </div>
          {/* Approved */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1 h-full bg-tertiary-container" />
            <div className="flex flex-col pl-xs min-w-0">
              <span className="text-label-lg text-on-surface-variant truncate">Approved</span>
              <span className="text-headline-md text-on-surface leading-tight">{isLoading ? "—" : approved}</span>
            </div>
            <span className="material-symbols-outlined text-on-tertiary-container/70 text-[28px] shrink-0">check_circle</span>
          </div>
        </div>

        {/* Recent updates — 4 cols */}
        <div className="col-span-1 lg:col-span-4 lg:row-span-2 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 flex flex-col h-full min-h-[320px]">
          <div className="p-md border-b border-outline-variant flex justify-between items-center">
            <h3 className="text-title-md text-on-surface">Recent Updates</h3>
            <button className="text-primary hover:bg-surface-container-low p-1 rounded transition-colors">
              <span className="material-symbols-outlined text-[20px]">more_horiz</span>
            </button>
          </div>
          <div className="p-md flex flex-col gap-md flex-1 overflow-y-auto">
            {recentUpdates.length === 0 ? (
              <p className="text-body-md text-on-surface-variant text-center py-4">No recent updates</p>
            ) : (
              recentUpdates.map((g) => {
                const { icon, cls, label } = updateMeta(g.status);
                return (
                  <div key={g.id} className="flex gap-md items-start">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5 ${cls}`}>
                      <span className="material-symbols-outlined text-[16px]">{icon}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-body-md text-on-surface truncate">{g.title}</p>
                      <p className="text-label-md text-on-surface-variant mt-xs">
                        {label} · {timeAgo(g.updatedAt)}
                      </p>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Active goals — 8 cols (sits beneath stats, beside Recent Updates) */}
        <div className="col-span-1 lg:col-span-8 min-h-0 flex flex-col">
          <div className="flex justify-between items-center mb-md shrink-0">
            <h3 className="text-title-lg text-on-surface">Current Objectives</h3>
            <Link
              to={ROUTES.EMPLOYEE.GOALS(userId)}
              className="text-title-md text-primary hover:underline flex items-center gap-1"
            >
              View All <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
            </Link>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto pr-1 -mr-1">
            {isLoading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 h-28 animate-pulse" />
                ))}
              </div>
            ) : activeGoals.length === 0 ? (
              <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl shadow-level-1 text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">target</span>
                <p className="text-body-lg text-on-surface-variant mt-md">No active goals yet.</p>
                <Link to={ROUTES.EMPLOYEE.GOALS(userId)} className="inline-flex items-center gap-sm text-primary mt-md text-body-md hover:underline">
                  Create your first goal
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md auto-rows-min">
                {activeGoals.map((goal) => (
                  <div key={goal.id} className="bg-surface-container-lowest border border-outline-variant rounded-xl p-md shadow-level-1 hover:shadow-level-2 transition-shadow flex flex-col gap-sm">
                    <div className="flex justify-between items-center gap-sm">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-label-sm uppercase tracking-wider ${statusChip(goal.status)}`}>
                        {statusLabel(goal.status)}
                      </span>
                      <button className="text-on-surface-variant hover:text-primary transition-colors -mr-1">
                        <span className="material-symbols-outlined text-[18px]">more_vert</span>
                      </button>
                    </div>
                    <h4 className="text-title-sm text-on-surface line-clamp-1">{goal.title}</h4>
                    <div className="mt-auto space-y-1">
                      <div className="flex justify-between text-label-sm">
                        <span className="text-on-surface-variant">Progress</span>
                        <span className="text-on-surface font-semibold">{(goal as any).currentValue ?? 0}%</span>
                      </div>
                      <div className="w-full bg-surface-container-high rounded-full h-1.5">
                        <div
                          className="bg-primary h-1.5 rounded-full transition-all"
                          style={{ width: `${Math.min((goal as any).currentValue ?? 0, 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
