import { useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  ArrowLeft,
  Pencil,
  Clock,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { GoalStatusBadge } from "@/components/goals/GoalStatusBadge";
import { GoalTimeline } from "@/components/goals/GoalTimeline";
import { GoalVersionDrawer } from "@/components/goals/GoalVersionDrawer";
import { WeightageBar } from "@/components/goals/WeightageBar";
import { ConfirmDialog } from "@/components/shared/ConfirmDialog";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { useSheetForReview, useApproveSheet, useReturnForRework, useInlineEditGoal } from "@/hooks/useApprovals";
import { GoalStatus, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { ROUTES } from "@/constants/routes";
import { cn } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface InlineEditState {
  targetValue: number | "";
  weightage: number | "";
  reason: string;
}

const EMPTY_EDIT: InlineEditState = { targetValue: "", weightage: "", reason: "" };

function getTargetDisplay(goal: Goal): string {
  if (goal.uomType === UoMType.ZERO) return "0 (Zero)";
  if (goal.uomType === UoMType.TIMELINE) {
    return goal.targetDate
      ? format(parseISO(goal.targetDate), "dd MMM yyyy")
      : "—";
  }
  const meta = UOM_TYPE_META[goal.uomType];
  return goal.targetValue !== null
    ? `${goal.targetValue} (${meta?.label ?? goal.uomType})`
    : "—";
}

function getSubmissionLabel(sheet: { submittedAt?: string }): string {
  if (!sheet.submittedAt) return "Not yet submitted";
  return `Submitted on ${format(parseISO(sheet.submittedAt), "dd MMM yyyy")}`;
}

// ─── Non-editable cell tooltip ────────────────────────────────────────────────

interface LockedCellProps {
  readonly children: React.ReactNode;
  readonly isEditing: boolean;
}

function LockedCell({ children, isEditing }: LockedCellProps) {
  if (!isEditing) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="opacity-50 cursor-not-allowed">{children}</span>
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs">
        Cannot be changed during review
      </TooltipContent>
    </Tooltip>
  );
}

// ─── Inline edit validation ───────────────────────────────────────────────────

function validateInlineEdit(
  editState: InlineEditState,
  goal: Goal,
  allGoals: Goal[]
): string | null {
  const needsTarget =
    goal.uomType !== UoMType.ZERO && goal.uomType !== UoMType.TIMELINE;

  if (needsTarget) {
    const targetNum = Number(editState.targetValue);
    if (!editState.targetValue || targetNum <= 0) {
      return "Target must be a positive number";
    }
  }

  const weightageNum = Number(editState.weightage);
  if (!editState.weightage || weightageNum < 10) {
    return "Weightage must be at least 10%";
  }

  const otherTotal = allGoals
    .filter((g) => g.id !== goal.id)
    .reduce((sum, g) => sum + g.weightage, 0);

  if (otherTotal + weightageNum !== 100) {
    return `Total would be ${otherTotal + weightageNum}% — must equal 100%`;
  }

  if (!editState.reason.trim()) {
    return "Please provide a reason for this change";
  }

  return null;
}

// ─── GoalReviewPage ───────────────────────────────────────────────────────────

export default function GoalReviewPage() {
  const { sheetId = "" } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();

  const { data: sheet, isLoading } = useSheetForReview(sheetId);
  const approveSheet = useApproveSheet();
  const returnForRework = useReturnForRework();
  const inlineEdit = useInlineEditGoal();

  // Inline edit state
  const [editingGoalId, setEditingGoalId] = useState<string | null>(null);
  const [editState, setEditState] = useState<InlineEditState>(EMPTY_EDIT);

  // Version drawer
  const [versionDrawer, setVersionDrawer] = useState<{ goalId: string; title: string } | null>(null);

  // Dialogs
  const [returnOpen, setReturnOpen] = useState(false);
  const [returnReason, setReturnReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(false);

  const employee = sheet ? USERS_BY_ID[sheet.userId] : undefined;
  const goals = sheet?.goals ?? [];

  // Determine timeline status from goals
  const timelineStatus = goals.some((g) => g.status === GoalStatus.UNDER_REVIEW)
    ? GoalStatus.UNDER_REVIEW
    : GoalStatus.SUBMITTED;

  // ── Inline edit handlers ─────────────────────────────────────────────────

  function startEdit(goal: Goal) {
    setEditingGoalId(goal.id);
    setEditState({
      targetValue: goal.targetValue ?? "",
      weightage: goal.weightage,
      reason: "",
    });
  }

  function cancelEdit() {
    setEditingGoalId(null);
    setEditState(EMPTY_EDIT);
  }

  function handleSaveEdit() {
    if (!editingGoalId) return;
    const goal = goals.find((g) => g.id === editingGoalId);
    if (!goal) return;

    const error = validateInlineEdit(editState, goal, goals);
    if (error) {
      toast.error(error);
      return;
    }

    const patch: Partial<Goal> = {
      weightage: Number(editState.weightage),
    };

    const needsTarget =
      goal.uomType !== UoMType.ZERO && goal.uomType !== UoMType.TIMELINE;
    if (needsTarget) {
      patch.targetValue = Number(editState.targetValue);
    }

    inlineEdit.mutate(
      { goalId: editingGoalId, patch },
      {
        onSuccess: () => {
          toast.success("Change saved · Version created");
          cancelEdit();
        },
      }
    );
  }

  // ── Return for rework ─────────────────────────────────────────────────────

  function handleReturnConfirm() {
    if (returnReason.trim().length < 20) {
      toast.error("Please provide at least 20 characters of feedback.");
      return;
    }
    returnForRework.mutate(
      { sheetId, reason: returnReason },
      {
        onSuccess: () => {
          const name = employee?.fullName ?? "the employee";
          toast.success(`Sheet returned to ${name} with your feedback.`);
          navigate(ROUTES.MANAGER.REVIEW);
        },
      }
    );
  }

  // ── Approve ──────────────────────────────────────────────────────────────

  function handleApproveConfirm() {
    approveSheet.mutate(sheetId, {
      onSuccess: () => {
        toast.success(`Goal sheet approved! All ${goals.length} goals are now locked.`);
        navigate(ROUTES.MANAGER.REVIEW);
      },
    });
  }

  // ── Loading ──────────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="py-20 text-center text-sm text-muted-foreground">
        Sheet not found.{" "}
        <Link to={ROUTES.MANAGER.REVIEW} className="text-indigo-600 hover:underline">
          Back to queue
        </Link>
      </div>
    );
  }

  const isSubmittedOrReview =
    sheet.status === GoalStatus.SUBMITTED ||
    goals.some((g) => g.status === GoalStatus.UNDER_REVIEW);

  return (
    <div className="space-y-5 pb-24">
      {/* Back + page title */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground hover:text-foreground -ml-1"
          onClick={() => navigate(ROUTES.MANAGER.REVIEW)}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Approval Queue
        </Button>
      </div>

      {/* Employee header card */}
      <div className="rounded-xl border bg-card p-5 space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Left: employee info + timeline */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-start gap-4">
              <Avatar className="h-14 w-14 shrink-0">
                <AvatarFallback className="bg-indigo-100 text-indigo-700 text-lg font-bold">
                  {employee?.avatarInitials ?? "??"}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <h1 className="text-lg font-semibold text-foreground">
                  {employee?.fullName ?? "Unknown Employee"}
                </h1>
                <p className="text-sm text-muted-foreground">
                  {employee?.departmentName} · {employee?.employeeCode}
                </p>
                <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                  <span>{getSubmissionLabel(sheet)}</span>
                  <span className="text-muted-foreground/40">·</span>
                  <span>First submission</span>
                  {employee?.managerName && (
                    <>
                      <span className="text-muted-foreground/40">·</span>
                      <span>Manager: {employee.managerName}</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Goal timeline strip */}
            <div className="pt-1">
              <GoalTimeline currentStatus={timelineStatus} />
            </div>
          </div>

          {/* Right: status + weightage bar */}
          <div className="space-y-4 flex flex-col justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Sheet Status</p>
              <GoalStatusBadge status={sheet.status} />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-2">Weightage Allocation</p>
              <WeightageBar goals={goals} showDetails={false} />
            </div>
          </div>
        </div>
      </div>

      {/* Info banner */}
      {isSubmittedOrReview && (
        <div className="flex items-start gap-3 p-3.5 rounded-lg bg-amber-50 border border-amber-200 text-sm text-amber-800">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            Reviewing <strong>{employee?.fullName ?? "this employee"}&apos;s</strong> goal sheet.
            You can edit <strong>targets</strong> and <strong>weightages</strong> before approving.
            Title, description, and UoM type cannot be changed.
          </span>
        </div>
      )}

      {/* Goals table */}
      <div className="rounded-xl border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              <TableHead className="text-xs font-semibold w-10 text-center">#</TableHead>
              <TableHead className="text-xs font-semibold">Goal Title</TableHead>
              <TableHead className="text-xs font-semibold hidden lg:table-cell">Thrust Area</TableHead>
              <TableHead className="text-xs font-semibold hidden md:table-cell">UoM</TableHead>
              <TableHead className="text-xs font-semibold">Target</TableHead>
              <TableHead className="text-xs font-semibold w-24">Weightage</TableHead>
              <TableHead className="text-xs font-semibold hidden sm:table-cell">Status</TableHead>
              <TableHead className="text-xs font-semibold w-20 text-center">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {goals.map((goal, idx) => {
              const isEditing = editingGoalId === goal.id;
              const uomMeta = UOM_TYPE_META[goal.uomType];
              const needsTarget =
                goal.uomType !== UoMType.ZERO && goal.uomType !== UoMType.TIMELINE;

              return (
                <>
                  <TableRow
                    key={goal.id}
                    className={cn(isEditing && "bg-indigo-50/40")}
                  >
                    {/* # */}
                    <TableCell className="text-center text-xs text-muted-foreground font-mono">
                      {idx + 1}
                    </TableCell>

                    {/* Goal Title */}
                    <TableCell className="max-w-[200px]">
                      <LockedCell isEditing={isEditing}>
                        <div>
                          <p className="text-xs font-semibold text-foreground leading-tight">
                            {goal.title}
                          </p>
                          {goal.description && (
                            <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                              {goal.description}
                            </p>
                          )}
                          {goal.isShared && (
                            <Badge className="mt-1 text-[9px] h-3.5 px-1 bg-amber-50 text-amber-700 border border-amber-200">
                              Shared KPI
                            </Badge>
                          )}
                        </div>
                      </LockedCell>
                    </TableCell>

                    {/* Thrust Area */}
                    <TableCell className="hidden lg:table-cell text-xs text-muted-foreground">
                      <LockedCell isEditing={isEditing}>
                        {formatThrustArea(goal.thrustArea)}
                      </LockedCell>
                    </TableCell>

                    {/* UoM */}
                    <TableCell className="hidden md:table-cell">
                      <LockedCell isEditing={isEditing}>
                        <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal">
                          {uomMeta?.label ?? goal.uomType}
                        </Badge>
                      </LockedCell>
                    </TableCell>

                    {/* Target */}
                    <TableCell>
                      {isEditing && needsTarget ? (
                        <Input
                          type="number"
                          min={0}
                          step="any"
                          value={editState.targetValue}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              targetValue: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                          className="h-7 w-24 text-xs"
                        />
                      ) : (
                        <span className="text-xs">{getTargetDisplay(goal)}</span>
                      )}
                    </TableCell>

                    {/* Weightage */}
                    <TableCell>
                      {isEditing ? (
                        <Input
                          type="number"
                          min={10}
                          max={100}
                          step={5}
                          value={editState.weightage}
                          onChange={(e) =>
                            setEditState((s) => ({
                              ...s,
                              weightage: e.target.value === "" ? "" : Number(e.target.value),
                            }))
                          }
                          className="h-7 w-20 text-xs"
                        />
                      ) : (
                        <Badge
                          variant="outline"
                          className="text-xs font-semibold bg-indigo-50 text-indigo-600 border-indigo-200"
                        >
                          {goal.weightage}%
                        </Badge>
                      )}
                    </TableCell>

                    {/* Status */}
                    <TableCell className="hidden sm:table-cell">
                      <GoalStatusBadge status={goal.status} size="sm" />
                    </TableCell>

                    {/* Actions */}
                    <TableCell>
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            className="h-6 px-2 text-[10px]"
                            onClick={handleSaveEdit}
                            disabled={inlineEdit.isPending}
                          >
                            {inlineEdit.isPending ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              "Save"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px]"
                            onClick={cancelEdit}
                            disabled={inlineEdit.isPending}
                          >
                            ✕
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1">
                          {isSubmittedOrReview && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-foreground"
                              title="Edit target / weightage"
                              onClick={() => startEdit(goal)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-foreground"
                            title="View version history"
                            onClick={() =>
                              setVersionDrawer({ goalId: goal.id, title: goal.title })
                            }
                          >
                            <Clock className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>

                  {/* Reason row — shown only in edit mode */}
                  {isEditing && (
                    <TableRow key={`${goal.id}-reason`} className="bg-indigo-50/40">
                      <TableCell colSpan={8} className="pt-0 pb-3 px-4">
                        <div className="flex items-center gap-2">
                          <Input
                            placeholder="Reason for change (required) *"
                            value={editState.reason}
                            onChange={(e) =>
                              setEditState((s) => ({ ...s, reason: e.target.value }))
                            }
                            className="flex-1 h-7 text-xs"
                          />
                          <span
                            className={cn(
                              "text-[10px] tabular-nums shrink-0",
                              editState.reason.length < 5
                                ? "text-muted-foreground"
                                : "text-emerald-600"
                            )}
                          >
                            {editState.reason.length} chars
                          </span>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Sticky bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur-sm px-6 py-3.5">
        <div className="max-w-screen-xl mx-auto flex items-center justify-between gap-4">
          {/* Return for rework */}
          <Button
            variant="outline"
            className="border-amber-300 text-amber-700 hover:bg-amber-50 hover:text-amber-800 gap-2"
            onClick={() => {
              setReturnReason("");
              setReturnOpen(true);
            }}
            disabled={!isSubmittedOrReview || returnForRework.isPending || approveSheet.isPending}
          >
            <RotateCcw className="h-4 w-4" />
            Return for Rework
          </Button>

          {/* Approve */}
          <Button
            size="lg"
            className="gap-2 bg-indigo-600 hover:bg-indigo-700"
            onClick={() => setApproveOpen(true)}
            disabled={!isSubmittedOrReview || approveSheet.isPending || returnForRework.isPending}
          >
            <CheckCircle className="h-4 w-4" />
            Approve Goal Sheet
          </Button>
        </div>
      </div>

      {/* Return for Rework dialog */}
      <Dialog open={returnOpen} onOpenChange={setReturnOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Return for Rework</DialogTitle>
            <DialogDescription>
              Explain what needs to change. The employee will receive your feedback and can re-submit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Textarea
              placeholder="Explain what needs to change…"
              rows={4}
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              className="resize-none text-sm"
            />
            <div className="flex items-center justify-between text-[11px]">
              <span className={cn(
                returnReason.length >= 20 ? "text-emerald-600" : "text-muted-foreground"
              )}>
                {returnReason.length} / 20 minimum characters
              </span>
              {returnReason.length > 0 && returnReason.length < 20 && (
                <span className="text-amber-600">Need {20 - returnReason.length} more</span>
              )}
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setReturnOpen(false)}
              disabled={returnForRework.isPending}
            >
              Cancel
            </Button>
            <Button
              className="bg-amber-500 hover:bg-amber-600 text-white gap-2"
              onClick={handleReturnConfirm}
              disabled={returnReason.trim().length < 20 || returnForRework.isPending}
            >
              {returnForRework.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Return to Employee
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Approve confirm dialog */}
      <ConfirmDialog
        open={approveOpen}
        onOpenChange={setApproveOpen}
        title="Approve Goal Sheet"
        description={`You are approving all ${goals.length} goal${goals.length !== 1 ? "s" : ""} for ${employee?.fullName ?? "this employee"}. They will be locked immediately and cannot be edited without Admin intervention.`}
        confirmLabel="Approve & Lock Goals"
        onConfirm={handleApproveConfirm}
        isLoading={approveSheet.isPending}
      />

      {/* Version history drawer */}
      {versionDrawer && (
        <GoalVersionDrawer
          open={Boolean(versionDrawer)}
          onClose={() => setVersionDrawer(null)}
          goalId={versionDrawer.goalId}
          goalTitle={versionDrawer.title}
        />
      )}
    </div>
  );
}
