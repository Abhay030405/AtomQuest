import { useState } from "react";
import { AlertCircle, Plus, Send, InfoIcon } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GoalCard } from "@/components/goals/GoalCard";
import { GoalForm } from "@/components/goals/GoalForm";
import type { GoalFormData } from "@/components/goals/GoalForm";
import { WeightageBar } from "@/components/goals/WeightageBar";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { EmptyState } from "@/components/shared/EmptyState";
import {
  useMyGoals,
  useMySheet,
  useCreateGoal,
  useUpdateGoal,
  useDeleteGoal,
  useSubmitSheet,
} from "@/hooks/useGoals";
import { useWeightage } from "@/hooks/useWeightage";
import { useWindowStatus } from "@/hooks/useWindowStatus";
import { useAuth } from "@/hooks/useAuth";
import { GoalStatus, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";

const CYCLE_ID = "cycle-fy2026";

// ─── Submit Sheet Dialog ──────────────────────────────────────────────────────

interface SubmitDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly goals: Goal[];
  readonly totalWeightage: number;
  readonly onConfirm: () => void;
  readonly isLoading: boolean;
}

function SubmitSheetDialog({
  open,
  onOpenChange,
  goals,
  totalWeightage,
  onConfirm,
  isLoading,
}: SubmitDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Submit Goal Sheet</DialogTitle>
          <DialogDescription>
            Review your goals before submitting to your manager. Once submitted, goals cannot be
            edited until returned for rework.
          </DialogDescription>
        </DialogHeader>

        {/* Goals summary table */}
        <div className="border rounded-lg overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Goal</th>
                <th className="text-left px-3 py-2 font-semibold text-muted-foreground">Area</th>
                <th className="text-right px-3 py-2 font-semibold text-muted-foreground w-16">
                  Weight
                </th>
              </tr>
            </thead>
            <tbody>
              {goals.map((goal, i) => (
                <tr key={goal.id} className={cn(i % 2 === 0 ? "bg-background" : "bg-muted/20")}>
                  <td className="px-3 py-2 max-w-[180px] truncate font-medium">{goal.title}</td>
                  <td className="px-3 py-2 text-muted-foreground truncate">
                    {formatThrustArea(goal.thrustArea)}
                  </td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">
                    {goal.weightage}%
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-muted/40 border-t">
              <tr>
                <td colSpan={2} className="px-3 py-2 font-semibold">
                  Total
                </td>
                <td
                  className={cn(
                    "px-3 py-2 text-right font-bold tabular-nums",
                    totalWeightage === 100 ? "text-emerald-600" : "text-red-600"
                  )}
                >
                  {totalWeightage}%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        {totalWeightage !== 100 && (
          <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-xs text-red-700">
            <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>Total weightage must equal exactly 100% before submitting.</span>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            Cancel
          </Button>
          <Button
            onClick={onConfirm}
            disabled={isLoading || totalWeightage !== 100}
          >
            {isLoading ? "Submitting…" : "Confirm & Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── MyGoals ──────────────────────────────────────────────────────────────────

export default function MyGoals() {
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? "";

  const { data: goals = [], isLoading: goalsLoading } = useMyGoals(CYCLE_ID);
  const { data: sheet, isLoading: sheetLoading } = useMySheet(CYCLE_ID);
  const { isWindowOpen } = useWindowStatus();
  const weightage = useWeightage(goals);

  const createGoal = useCreateGoal();
  const updateGoal = useUpdateGoal();
  const deleteGoal = useDeleteGoal();
  const submitSheet = useSubmitSheet(CYCLE_ID);

  // Sheet state
  const [sheetMode, setSheetMode] = useState<"create" | "edit" | null>(null);
  const [editTarget, setEditTarget] = useState<Goal | null>(null);

  // Confirm delete dialog
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Submit dialog
  const [submitOpen, setSubmitOpen] = useState(false);

  const isLoading = goalsLoading || sheetLoading;
  const sheetStatus = sheet?.status ?? GoalStatus.DRAFT;
  const isDraft = sheetStatus === GoalStatus.DRAFT;
  const isReadOnly = !isDraft || !isWindowOpen;

  // ── Handlers ────────────────────────────────────────────────────────────────

  function openCreate() {
    setEditTarget(null);
    setSheetMode("create");
  }

  function openEdit(goal: Goal) {
    setEditTarget(goal);
    setSheetMode("edit");
  }

  function closeSheet() {
    setSheetMode(null);
    setEditTarget(null);
  }

  function handleFormSubmit(data: GoalFormData) {
    if (sheetMode === "create") {
      createGoal.mutate(
        {
          ...data,
          thrustArea: data.thrustArea as Goal["thrustArea"],
          uomType: data.uomType as Goal["uomType"],
          targetValue: data.uomType === UoMType.ZERO || data.uomType === UoMType.TIMELINE
            ? null
            : (data.targetValue ?? null),
          targetDate: data.uomType === UoMType.TIMELINE ? data.targetDate : undefined,
          userId,
          cycleId: CYCLE_ID,
        },
        { onSuccess: closeSheet }
      );
    } else if (sheetMode === "edit" && editTarget) {
      updateGoal.mutate(
        {
          id: editTarget.id,
          patch: {
            ...data,
            thrustArea: data.thrustArea as Goal["thrustArea"],
            uomType: data.uomType as Goal["uomType"],
            targetValue: data.uomType === UoMType.ZERO || data.uomType === UoMType.TIMELINE
              ? null
              : (data.targetValue ?? null),
            targetDate: data.uomType === UoMType.TIMELINE ? data.targetDate : undefined,
          },
        },
        { onSuccess: closeSheet }
      );
    }
  }

  function handleDeleteConfirm() {
    if (!deleteId) return;
    deleteGoal.mutate(deleteId, {
      onSuccess: () => setDeleteId(null),
    });
  }

  function handleSubmitSheet() {
    submitSheet.mutate(undefined, {
      onSuccess: () => setSubmitOpen(false),
    });
  }

  // Submit button tooltip reason
  function getSubmitDisabledReason(): string | null {
    if (!isWindowOpen) return "Goal-setting window is closed";
    if (!isDraft) return "Sheet has already been submitted";
    if (goals.length === 0) return "Add at least one goal first";
    if (weightage.totalWeightage !== 100) return `Total weightage is ${weightage.totalWeightage}% — must be exactly 100%`;
    return null;
  }

  const submitDisabledReason = getSubmitDisabledReason();
  const canSubmit = submitDisabledReason === null;

  const formMutating =
    (sheetMode === "create" && createGoal.isPending) ||
    (sheetMode === "edit" && updateGoal.isPending);

  // Edit defaults
  const editDefaults: Partial<GoalFormData> | undefined = editTarget
    ? {
        title: editTarget.title,
        description: editTarget.description,
        thrustArea: editTarget.thrustArea,
        uomType: editTarget.uomType,
        targetValue: editTarget.targetValue ?? undefined,
        targetDate: editTarget.targetDate,
        weightage: editTarget.weightage,
      }
    : undefined;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">My Goals</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            FY 2026 · {goals.length} goal{goals.length !== 1 ? "s" : ""} added
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Sheet status badge */}
          {!isLoading && <GoalStatusBadge status={sheetStatus} />}

          {/* Submit button */}
          {!isReadOnly && (
            <div className="relative group">
              <Button
                size="sm"
                variant="outline"
                className="gap-1.5"
                onClick={() => setSubmitOpen(true)}
                disabled={!canSubmit}
              >
                <Send className="h-3.5 w-3.5" />
                Submit Sheet
              </Button>
              {!canSubmit && submitDisabledReason && (
                <div className="absolute right-0 top-full mt-1.5 z-50 hidden group-hover:block">
                  <div className="flex items-start gap-1.5 bg-popover border rounded-md shadow-md px-3 py-2 text-xs max-w-[220px] whitespace-normal">
                    <InfoIcon className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                    {submitDisabledReason}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Add goal button */}
          {!isReadOnly && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={openCreate}
              disabled={!weightage.canAddMore}
            >
              <Plus className="h-3.5 w-3.5" />
              Add Goal
            </Button>
          )}
        </div>
      </div>

      {/* Weightage bar */}
      {!isLoading && goals.length > 0 && (
        <WeightageBar goals={goals} showDetails />
      )}

      {/* Window closed notice */}
      {!isWindowOpen && (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>The goal-setting window is closed. Goals are read-only.</span>
        </div>
      )}

      {/* Goal list */}
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {["a", "b", "c", "d"].map((k) => (
            <Skeleton key={k} className="h-44 rounded-xl" />
          ))}
        </div>
      ) : goals.length === 0 ? (
        <EmptyState
          variant={isWindowOpen ? "no-goals" : "window-closed"}
          action={
            isWindowOpen
              ? { label: "Add First Goal", onClick: openCreate }
              : undefined
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {goals.map((goal) => (
            <GoalCard
              key={goal.id}
              goal={goal}
              isReadOnly={isReadOnly}
              isWindowOpen={isWindowOpen}
              onEdit={openEdit}
              onDelete={(id) => setDeleteId(id)}
            />
          ))}
        </div>
      )}

      {/* Add / Edit Sheet */}
      <Sheet open={sheetMode !== null} onOpenChange={(open) => !open && closeSheet()}>
        <SheetContent className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader className="mb-4">
            <SheetTitle>{sheetMode === "create" ? "Add Goal" : "Edit Goal"}</SheetTitle>
            <SheetDescription>
              {sheetMode === "create"
                ? "Define a new goal for FY 2026."
                : "Update the details of this goal."}
            </SheetDescription>
          </SheetHeader>

          {sheetMode && (
            <GoalForm
              mode={sheetMode}
              defaultValues={editDefaults}
              remainingWeightage={weightage.remainingWeightage}
              onSubmit={handleFormSubmit}
              onCancel={closeSheet}
              isLoading={formMutating}
            />
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <ConfirmDialog
        open={Boolean(deleteId)}
        onOpenChange={(open) => !open && setDeleteId(null)}
        title="Delete Goal"
        description="This action cannot be undone. The goal will be permanently removed from your sheet."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDeleteConfirm}
        isLoading={deleteGoal.isPending}
      />

      {/* Submit sheet dialog */}
      <SubmitSheetDialog
        open={submitOpen}
        onOpenChange={setSubmitOpen}
        goals={goals}
        totalWeightage={weightage.totalWeightage}
        onConfirm={handleSubmitSheet}
        isLoading={submitSheet.isPending}
      />
    </div>
  );
}
