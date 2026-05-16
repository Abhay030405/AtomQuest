import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCycleStore } from "@/store/cycleStore";
import { useMyGoals, useSubmitSheet, useCreateGoal, useUpdateGoal } from "@/hooks/useGoals";
import { ROUTES } from "@/constants/routes";
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
  { id: "submitted", title: "Submitted Goals", dot: "bg-blue-500",            emptyMsg: "Drop drafts here to submit" },
  { id: "approved",  title: "Approved Goals",  dot: "bg-emerald-500",         emptyMsg: "Nothing approved yet" },
  { id: "rejected",  title: "Rejected Goals",  dot: "bg-rose-500",            emptyMsg: "No rejections" },
];

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

function classifyGoal(g: Goal): ColumnId | null {
  switch (g.status) {
    case "draft":
      return (g as any).managerComment ? "rejected" : "draft";
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
  const draggable = column === "draft";
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
        "relative bg-white rounded-xl border border-outline-variant p-3 shadow-sm transition-all",
        draggable ? "cursor-grab active:cursor-grabbing hover:shadow-md hover:border-primary/40" : "",
        isDragging ? "opacity-40" : "",
      ].join(" ")}
    >
      {column === "draft" && (
        <button
          onClick={() => onEdit(goal)}
          title="Edit"
          className="absolute top-2 right-2 p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-surface-container transition-colors"
        >
          <span className="material-symbols-outlined text-[16px]">edit</span>
        </button>
      )}

      <h4 className="text-[13px] font-semibold text-on-surface leading-snug line-clamp-2 pr-6 mb-1.5">
        {goal.title}
      </h4>

      <div className="flex flex-wrap gap-1.5 mb-2">
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-medium">
          {THRUST_LABEL[goal.thrustArea] ?? goal.thrustArea}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[11px] font-medium">
          {UOM_LABEL[goal.uomType] ?? goal.uomType}
        </span>
      </div>

      <div className="space-y-0.5 text-[12px]">
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">Target :</span>
          <span className="font-semibold text-on-surface tabular-nums">{formatTarget(goal)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-on-surface-variant">Weightage :</span>
          <span className="font-semibold text-on-surface tabular-nums">{goal.weightage}%</span>
        </div>
      </div>
    </div>
  );
}

export default function MyGoals() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const activeWindow = useCycleStore((s) => s.activeWindow);
  const { data: goals = [], isLoading } = useMyGoals(activeWindow?.id);
  const submitMutation = useSubmitSheet(activeWindow?.id ?? "");
  const userId = currentUser?.id ?? "";

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<ColumnId | null>(null);

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

  function handleDrop(targetCol: ColumnId) {
    const id = draggingId;
    setDraggingId(null);
    setDragOverCol(null);
    if (!id || targetCol !== "submitted" || !activeWindow?.id) return;

    const goal = goals.find((g) => g.id === id);
    if (!goal || classifyGoal(goal) !== "draft") return;

    submitMutation.mutate(undefined, {
      onError: (err: any) => {
        alert(err?.message ?? "Failed to submit goals for review");
      },
    });
  }

  const grouped: Record<ColumnId, Goal[]> = { draft: [], submitted: [], approved: [], rejected: [] };
  for (const g of goals) {
    const c = classifyGoal(g);
    if (c) grouped[c].push(g);
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full space-y-xl">
      {/* Page header */}
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div>
          <h2 className="text-display-lg text-on-surface mb-xs">My Goals</h2>
          <p className="text-body-lg text-on-surface-variant">
            Manage your goals across stages. Drag a draft into{" "}
            <span className="font-medium text-on-surface">Submitted</span> to send for approval.
          </p>
        </div>
        <button
          onClick={openCreate}
          className="inline-flex items-center gap-sm bg-primary text-on-primary rounded-lg py-2 px-md text-title-md border-t border-white/20 shadow-level-1 hover:opacity-90 transition-all"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Goal
        </button>
      </div>

      {/* Kanban — always 4 columns in a single row, horizontal scroll on small screens */}
      <div className="w-full overflow-x-auto pb-2">
        <div className="grid grid-cols-4 gap-3 min-w-[1000px]">
          {COLUMNS.map((col) => {
            const items = grouped[col.id];
            const isDropTarget = col.id === "submitted";
            const isHovered = dragOverCol === col.id && isDropTarget && draggingId != null;

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

                {/* Column body */}
                <div className="p-2.5 flex-1 space-y-2.5 min-h-[300px] bg-surface-container/30">
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

      {submitMutation.isPending && (
        <div className="fixed bottom-lg right-lg bg-surface-container-highest text-on-surface px-md py-sm rounded-lg shadow-level-3 border border-outline-variant flex items-center gap-sm">
          <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
          Submitting for approval…
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
