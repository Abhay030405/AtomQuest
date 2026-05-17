import { useEffect, useMemo, useState } from "react";
import { useAuthStore } from "@/store/authStore";
import { useCycleStore } from "@/store/cycleStore";
import { useMyGoals, useSubmitSheet, useCreateGoal, useUpdateGoal } from "@/hooks/useGoals";
import type { Goal } from "@/types/goal.types";
import { GoalFormDialog, type GoalFormValues } from "@/components/goals/GoalFormDialog";

type ColumnId = "draft" | "submitted" | "approved" | "rejected";

interface ColumnDef {
  id: ColumnId;
  title: string;
  dot: string;   // colored dot in header
  emptyMsg: string;
}

const COLUMNS: ColumnDef[] = [
  { id: "draft",     title: "Draft Goals",     dot: "bg-on-surface-variant", emptyMsg: "No drafts" },
  { id: "submitted", title: "Submitted Goals", dot: "bg-blue-500",            emptyMsg: "Drag a draft here to add it to this cycle's sheet" },
  { id: "approved",  title: "Approved Goals",  dot: "bg-emerald-500",         emptyMsg: "Nothing approved yet" },
  { id: "rejected",  title: "Rejected Goals",  dot: "bg-rose-500",            emptyMsg: "No rejections" },
];

// Local-storage key for the per-cycle "staged for submission" set
function stageStorageKey(userId: string, cycleId: string): string {
  return `atomquest:staged-goals:${userId}:${cycleId}`;
}

// Per-column accent stripe + glow used by GoalKanbanCard
const COLUMN_ACCENT: Record<ColumnId, { stripe: string; ring: string; icon: string; iconBg: string }> = {
  draft:     { stripe: "bg-slate-300",     ring: "hover:ring-slate-300/60",   icon: "edit_note",        iconBg: "bg-slate-100 text-slate-600" },
  submitted: { stripe: "bg-blue-500",      ring: "hover:ring-blue-300/60",    icon: "hourglass_top",    iconBg: "bg-blue-50 text-blue-600" },
  approved:  { stripe: "bg-emerald-500",   ring: "hover:ring-emerald-300/60", icon: "check_circle",     iconBg: "bg-emerald-50 text-emerald-600" },
  rejected:  { stripe: "bg-rose-500",      ring: "hover:ring-rose-300/60",    icon: "error",            iconBg: "bg-rose-50 text-rose-600" },
};

const THRUST_LABEL: Record<string, string> = {
  REVENUE_GROWTH: "Revenue Growth",
  CUSTOMER_SATISFACTION: "Customer Satisfaction",
  OPERATIONAL_EXCELLENCE: "Operational Excellence",
  PEOPLE_DEVELOPMENT: "People Development",
  SAFETY_COMPLIANCE: "Safety & Compliance",
  INNOVATION: "Innovation",
  COST_OPTIMISATION: "Cost Optimisation",
  QUALITY: "Quality",
};

const UOM_LABEL: Record<string, string> = {
  MIN: "Higher is better",
  MAX: "Lower is better",
  TIMELINE: "Deadline",
  ZERO: "Zero target",
};

function classifyGoal(g: Goal, stagedIds: ReadonlySet<string>): ColumnId | null {
  switch (g.status) {
    case "draft":
      if ((g as any).managerComment) return "rejected";
      return stagedIds.has(g.id) ? "submitted" : "draft";
    case "submitted":
    case "under-review":
      return "submitted";
    case "approved":
    case "locked":
      return "approved";
    default:
      return null;
  }
}

function formatTarget(g: Goal): string {
  if (g.uomType === "TIMELINE") {
    return g.targetDate
      ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";
  }
  return g.targetValue != null ? String(g.targetValue) : "—";
}

interface GoalCardProps {
  goal: Goal;
  column: ColumnId;
  onEdit: (g: Goal) => void;
  onDragStart: (g: Goal) => void;
  onDragEnd: () => void;
  isDragging: boolean;
}

function GoalKanbanCard({ goal, column, onEdit, onDragStart, onDragEnd, isDragging }: Readonly<GoalCardProps>) {
  // Drafts can be dragged forward; locally-staged "submitted" cards (status still draft
  // in the database) can be dragged back to drafts. Truly submitted/approved cards
  // cannot be dragged.
  const draggable = column === "draft" || (column === "submitted" && goal.status === "draft");
  const accent = COLUMN_ACCENT[column];
  const weightage = Math.max(0, Math.min(100, Number(goal.weightage) || 0));
  const rejectionNote = column === "rejected" ? (goal as any).managerComment : null;

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", goal.id);
        onDragStart(goal);
      }}
      onDragEnd={onDragEnd}
      className={[
        "group relative bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 hover:ring-2",
        accent.ring,
        draggable ? "cursor-grab active:cursor-grabbing" : "",
        isDragging ? "opacity-40 rotate-1 scale-[0.98]" : "",
      ].join(" ")}
    >
      {/* Left accent stripe */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent.stripe}`} aria-hidden />

      <div className="pl-3 pr-3 py-3">
        {/* Header row: status icon + title + edit */}
        <div className="flex items-start gap-2 mb-2">
          <span className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md ${accent.iconBg}`}>
            <span className="material-symbols-outlined text-[15px]">{accent.icon}</span>
          </span>
          <h4 className="flex-1 text-[13px] font-semibold text-on-surface leading-snug line-clamp-2 pr-5">
            {goal.title}
          </h4>
          {(column === "draft" || (column === "submitted" && goal.status === "draft")) && (
            <button
              onClick={() => onEdit(goal)}
              title="Edit"
              className="absolute top-2 right-2 p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary-container/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
          )}
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10.5px] font-medium">
            <span className="material-symbols-outlined text-[12px] leading-none">flag</span>
            {THRUST_LABEL[goal.thrustArea] ?? goal.thrustArea}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10.5px] font-medium">
            <span className="material-symbols-outlined text-[12px] leading-none">trending_up</span>
            {UOM_LABEL[goal.uomType] ?? goal.uomType}
          </span>
        </div>

        {/* Metrics block */}
        <div className="rounded-lg bg-surface-container/50 border border-outline-variant/60 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[13px] leading-none">target</span>
              Target
            </span>
            <span className="font-semibold text-on-surface tabular-nums">{formatTarget(goal)}</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="inline-flex items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px] leading-none">monitoring</span>
                Weightage
              </span>
              <span className="font-semibold text-on-surface tabular-nums">{weightage}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-outline-variant/50 overflow-hidden">
              <div
                className={`h-full rounded-full ${accent.stripe} transition-all`}
                style={{ width: `${weightage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Rejection comment (only for rejected) */}
        {rejectionNote && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800 flex gap-1.5">
            <span className="material-symbols-outlined text-[13px] leading-none mt-px">comment</span>
            <span className="line-clamp-2">{rejectionNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default function MyGoals() {
  const { currentUser } = useAuthStore();
  const activeWindow = useCycleStore((s) => s.activeWindow);
  const { data: goals = [], isLoading } = useMyGoals(activeWindow?.id);
  const submitSheetMutation = useSubmitSheet(activeWindow?.id ?? "");
  const userId = currentUser?.id ?? "";
  const managerName = currentUser?.managerName?.trim() || "Manager";

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Locally-staged draft goal ids ("Submitted" column on the client) — persisted
  // per (user, cycle) so a refresh doesn't lose the user's progress. These remain
  // DRAFT in the database until the employee clicks "Send to Manager".
  const stageKey = userId && activeWindow?.id ? stageStorageKey(userId, activeWindow.id) : "";
  const [stagedIds, setStagedIds] = useState<Set<string>>(() => new Set());
  useEffect(() => {
    if (!stageKey) {
      setStagedIds(new Set());
      return;
    }
    try {
      const raw = globalThis.localStorage?.getItem(stageKey);
      const parsed = raw ? (JSON.parse(raw) as unknown) : [];
      setStagedIds(new Set(Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : []));
    } catch {
      setStagedIds(new Set());
    }
  }, [stageKey]);
  function persistStaged(next: Set<string>) {
    setStagedIds(next);
    if (stageKey) {
      try { globalThis.localStorage?.setItem(stageKey, JSON.stringify([...next])); } catch { /* noop */ }
    }
  }

  // Goal create/edit dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);
  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const submitting = createGoal.isPending || updateGoal.isPending;

  function openEdit(g: Goal) {
    setEditing(g);
    setDialogOpen(true);
  }

  function openCreate() {
    setEditing(null);
    setDialogOpen(true);
  }

  async function handleDialogSubmit(values: GoalFormValues) {
    if (editing) {
      await updateGoal.mutateAsync({ id: editing.id, patch: values });
    } else {
      if (!activeWindow?.id) throw new Error("No active cycle");
      await createGoal.mutateAsync({
        ...values,
        cycleId: activeWindow.id,
        userId,
      } as any);
    }
  }

  const grouped: Record<ColumnId, Goal[]> = { draft: [], submitted: [], approved: [], rejected: [] };
  for (const g of goals) {
    const c = classifyGoal(g, stagedIds);
    if (c) grouped[c].push(g);
  }

  // Reconcile staged set with reality: prune ids that no longer correspond to a
  // local DRAFT goal (e.g. server already accepted the sheet → status flipped to
  // submitted/approved, or the goal was deleted).
  useEffect(() => {
    if (!stageKey || stagedIds.size === 0) return;
    const validIds = new Set(goals.filter((g) => g.status === "draft" && !(g as any).managerComment).map((g) => g.id));
    const pruned = [...stagedIds].filter((id) => validIds.has(id));
    if (pruned.length !== stagedIds.size) persistStaged(new Set(pruned));
     
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goals, stageKey]);

  // Weightage meter: only counts goals that will actually be on the sheet sent to
  // the manager — i.e. locally-staged drafts + already-submitted + approved/locked.
  // Unstaged drafts and rejected goals are excluded.
  const meterGoals = useMemo(
    () => goals.filter((g) => {
      if ((g as any).managerComment && g.status === "draft") return false; // rejected
      if (g.status === "draft") return stagedIds.has(g.id);
      return g.status === "submitted" || g.status === "under-review" || g.status === "approved" || g.status === "locked";
    }),
    [goals, stagedIds],
  );
  const totalWeightage = meterGoals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0);
  const weightageRounded = Math.round(totalWeightage * 100) / 100;
  const weightageOk = weightageRounded === 100;

  // Are there any locally-staged drafts (i.e. anything pending a "Send to Manager" call)?
  const stagedDraftGoals = useMemo(
    () => goals.filter((g) => g.status === "draft" && !(g as any).managerComment && stagedIds.has(g.id)),
    [goals, stagedIds],
  );
  const canSendToManager = weightageOk && stagedDraftGoals.length > 0 && !submitSheetMutation.isPending;

  function handleDrop(targetCol: ColumnId) {
    const id = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!id) return;

    const goal = goals.find((g) => g.id === id);
    if (!goal || goal.status !== "draft" || (goal as any).managerComment) return;

    const next = new Set(stagedIds);
    if (targetCol === "submitted") {
      next.add(id);
    } else if (targetCol === "draft") {
      next.delete(id);
    } else {
      return;
    }
    persistStaged(next);
  }

  function handleSendToManager() {
    if (!canSendToManager) return;
    const ids = [...stagedIds];
    submitSheetMutation.mutate(ids, {
      onSuccess: () => {
        // Clear staged set — server has now flipped goals to SUBMITTED so they
        // belong in the Submitted column on their own merits.
        persistStaged(new Set());
        setSuccessMsg(`Goal sheet sent to ${managerName} for review`);
        globalThis.setTimeout(() => setSuccessMsg(null), 4000);
      },
      onError: (err: any) => {
        alert(err?.message ?? "Failed to send goal sheet to manager");
      },
    });
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full space-y-xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div>
          <h2 className="text-display-lg text-on-surface mb-xs">My Goals</h2>
          <p className="text-body-lg text-on-surface-variant">
            Manage your goals across stages. Drag a draft into{" "}
            <span className="font-medium text-on-surface">Submitted</span> to send that goal for approval.
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            type="button"
            onClick={handleSendToManager}
            disabled={!canSendToManager}
            title={
              !weightageOk
                ? `Reach 100% weightage to enable (currently ${weightageRounded}%)`
                : stagedDraftGoals.length === 0
                  ? "Drag drafts into Submitted Goals first"
                  : `Send full goal sheet to ${managerName}`
            }
            className={[
              "inline-flex items-center gap-sm rounded-lg py-2 px-md text-title-md border-t border-white/20 shadow-level-1 transition-all",
              canSendToManager
                ? "bg-emerald-600 text-white hover:bg-emerald-700"
                : "bg-surface-container-low text-on-surface-variant border-outline-variant cursor-not-allowed opacity-70",
            ].join(" ")}
          >
            {submitSheetMutation.isPending ? (
              <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
            ) : (
              <span className="material-symbols-outlined text-[18px]">send</span>
            )}
            Send to {managerName}
          </button>
          <button
            onClick={openCreate}
            className="inline-flex items-center gap-sm bg-primary text-on-primary rounded-lg py-2 px-md text-title-md border-t border-white/20 shadow-level-1 hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Goal
          </button>
        </div>
      </div>

      {/* Weightage tracker (circular) */}
      {(() => {
        const pct = Math.max(0, Math.min(100, weightageRounded));
        const size = 88;
        const stroke = 9;
        const radius = (size - stroke) / 2;
        const circumference = 2 * Math.PI * radius;
        const dashOffset = circumference * (1 - pct / 100);

        let ringColor = "stroke-rose-500";
        let textColor = "text-rose-600";
        let chipBg = "bg-rose-50 text-rose-700 border-rose-200";
        let icon = "error";
        let statusText = `Total weightage must equal 100% — currently ${weightageRounded}%`;
        let helperText = `Add ${(100 - weightageRounded).toFixed(2).replace(/\.?0+$/, "")}% more to reach 100%.`;

        if (weightageOk) {
          ringColor = "stroke-emerald-500";
          textColor = "text-emerald-600";
          chipBg = "bg-emerald-50 text-emerald-700 border-emerald-200";
          icon = "check_circle";
          statusText = `Ready — total weightage is 100%. Click "Send to ${managerName}".`;
          helperText = `All ${stagedDraftGoals.length} staged goal(s) will be sent on submit.`;
        } else if (weightageRounded > 100) {
          ringColor = "stroke-rose-500";
          textColor = "text-rose-600";
          chipBg = "bg-rose-50 text-rose-700 border-rose-200";
          icon = "error";
          const over = (weightageRounded - 100).toFixed(2).replace(/\.?0+$/, "");
          statusText = `Over by ${over}% — reduce weightage to reach 100%`;
          helperText = `Edit draft goals and reduce a combined ${over}% to reach 100%.`;
        } else if (weightageRounded > 0) {
          ringColor = "stroke-amber-500";
          textColor = "text-amber-600";
          chipBg = "bg-amber-50 text-amber-800 border-amber-200";
          icon = "pending";
          const remaining = (100 - weightageRounded).toFixed(2).replace(/\.?0+$/, "");
          statusText = `${weightageRounded}% allocated — ${remaining}% remaining`;
          helperText = `Add ${remaining}% more to reach 100%.`;
        }

        return (
          <div className="rounded-xl border border-outline-variant bg-white px-4 py-3 shadow-sm flex items-center gap-4">
            {/* Circular tracker */}
            <div className="relative shrink-0" style={{ width: size, height: size }}>
              <svg width={size} height={size} className="-rotate-90">
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={stroke}
                  className="stroke-outline-variant/50 fill-none"
                />
                <circle
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  strokeWidth={stroke}
                  strokeLinecap="round"
                  className={`fill-none transition-all duration-300 ${ringColor}`}
                  strokeDasharray={circumference}
                  strokeDashoffset={dashOffset}
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-[16px] font-bold tabular-nums leading-none ${textColor}`}>
                  {weightageRounded}%
                </span>
                <span className="text-[9.5px] text-on-surface-variant mt-0.5">of 100%</span>
              </div>
            </div>

            {/* Status text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1 flex-wrap">
                <h3 className="text-[13px] font-semibold text-on-surface">Total Weightage</h3>
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[11px] font-medium ${chipBg}`}>
                  <span className="material-symbols-outlined text-[13px] leading-none">{icon}</span>
                  {statusText}
                </span>
              </div>
              <p className="text-[11.5px] text-on-surface-variant">
                {helperText} Counts only Submitted / Approved goals — drafts in the first column don&apos;t count yet.
              </p>
            </div>
          </div>
        );
      })()}

      {/* Kanban — always 4 columns in a single row, horizontal scroll on small screens */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="grid grid-cols-4 gap-3 min-w-[1000px]">
          {COLUMNS.map((col) => {
            const items = grouped[col.id];
            const isDropTarget = col.id === "submitted" || col.id === "draft";
            const isHovered = dragOverCol === col.id && isDropTarget && draggingId != null;
            const blockedDrop = false;

            return (
              <div
                key={col.id}
                onDragOver={(e) => {
                  if (!isDropTarget || draggingId == null) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dragOverCol !== col.id) setDragOverCol(col.id);
                }}
                onDragLeave={() => {
                  if (dragOverCol === col.id) setDragOverCol(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  handleDrop(col.id);
                }}
                className={[
                  "rounded-xl border border-outline-variant bg-surface-container-lowest flex flex-col overflow-hidden transition-all",
                  isHovered ? "ring-2 ring-primary border-primary bg-primary-container/20" : "",
                  blockedDrop ? "ring-2 ring-rose-300 border-rose-300 bg-rose-50/40" : "",
                ].join(" ")}
              >
                {/* Column header */}
                <div className="px-3 py-2.5 border-b border-outline-variant flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                    <h3 className="text-[13px] font-semibold text-on-surface">{col.title}</h3>
                  </div>
                  <span className="text-[12px] text-on-surface-variant tabular-nums">{items.length}</span>
                </div>

                {/* Column body — scroller kicks in after ~3 cards */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[300px] max-h-[640px] overflow-y-auto bg-surface-container/30 scrollbar-thin">
                  {(() => {
                    if (isLoading) {
                      return (
                        <div className="space-y-2.5">
                          <div className="h-24 bg-white rounded-xl border border-outline-variant animate-pulse" />
                          <div className="h-24 bg-white rounded-xl border border-outline-variant animate-pulse" />
                        </div>
                      );
                    }
                    if (items.length === 0) {
                      return (
                        <div className="h-full min-h-[260px] flex items-center justify-center text-center text-on-surface-variant">
                          <p className="text-[12px]">{col.emptyMsg}</p>
                        </div>
                      );
                    }
                    return items.map((goal) => (
                      <GoalKanbanCard
                        key={goal.id}
                        goal={goal}
                        column={col.id}
                        onEdit={openEdit}
                        onDragStart={(g) => setDraggingId(g.id)}
                        onDragEnd={() => {
                          setDraggingId(null);
                          setDragOverCol(null);
                        }}
                        isDragging={draggingId === goal.id}
                      />
                    ));
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {submitSheetMutation.isPending && (
        <div className="fixed bottom-lg right-lg bg-surface-container-highest text-on-surface px-md py-sm rounded-lg shadow-level-3 border border-outline-variant flex items-center gap-sm">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Sending goal sheet to {managerName}…
        </div>
      )}

      {successMsg && !submitSheetMutation.isPending && (
        <div
          role="status"
          className="fixed bottom-lg right-lg bg-emerald-50 text-emerald-800 border border-emerald-200 px-md py-sm rounded-lg shadow-level-3 flex items-center gap-sm animate-in fade-in slide-in-from-bottom-2"
        >
          <span className="material-symbols-outlined text-[18px] text-emerald-600">check_circle</span>
          <span>{successMsg}</span>
          <button
            type="button"
            onClick={() => setSuccessMsg(null)}
            className="ml-sm text-emerald-700 hover:text-emerald-900"
            aria-label="Dismiss"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
          </button>
        </div>
      )}

      <GoalFormDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        mode={editing ? "edit" : "create"}
        initial={editing}
        onSubmit={handleDialogSubmit}
        submitting={submitting}
      />
    </div>
  );
}
