import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSheetForReview, useApproveSheet, useReturnForRework } from "@/hooks/useApprovals";
import { useAuthStore } from "@/store/authStore";
import { ROUTES } from "@/constants/routes";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function GoalReviewPage() {
  const { sheetId } = useParams<{ sheetId: string }>();
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { data: sheet, isLoading } = useSheetForReview(sheetId ?? "");
  const approveSheet = useApproveSheet();
  const returnForRework = useReturnForRework();

  const [comment, setComment] = useState("");
  const goals = sheet?.goals ?? [];
  const totalWeight = goals.reduce((sum: number, g: any) => sum + (g.weightage ?? 0), 0);

  const initials = (name: string) =>
    (name ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  async function handleApprove() {
    if (!sheetId) return;
    try {
      await approveSheet.mutateAsync({ sheetId });
      toast.success("Goal sheet approved");
      navigate(ROUTES.MANAGER.REVIEW(currentUser?.id ?? ""));
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function handleRework() {
    if (!sheetId || !comment.trim()) {
      toast.error("Please add a comment before returning for rework");
      return;
    }
    try {
      await returnForRework.mutateAsync({ sheetId, comment });
      toast.success("Returned for rework");
      navigate(ROUTES.MANAGER.REVIEW(currentUser?.id ?? ""));
    } catch {
      toast.error("Failed to return for rework");
    }
  }

  if (isLoading) {
    return (
      <div className="p-margin-desktop flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-md text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] animate-spin">progress_activity</span>
          <p className="text-body-lg">Loading goal sheet...</p>
        </div>
      </div>
    );
  }

  if (!sheet) {
    return (
      <div className="p-margin-desktop text-center py-xl">
        <span className="material-symbols-outlined text-[64px] text-on-surface-variant/40">search_off</span>
        <p className="text-body-lg text-on-surface-variant mt-md">Goal sheet not found</p>
      </div>
    );
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-4xl mx-auto space-y-lg pb-32 relative">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-md border-b border-outline-variant pb-md">
        <div className="flex items-center gap-md">
          <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-md font-bold border border-outline-variant">
            {initials(sheet.employeeName ?? "")}
          </div>
          <div>
            <h2 className="text-headline-md text-on-surface">{sheet.employeeName}'s Goal Sheet</h2>
            <p className="text-body-md text-on-surface-variant">{sheet.employeeRole ?? "—"} • {sheet.cycleName ?? "—"}</p>
          </div>
        </div>
        <div className="bg-surface-container border border-outline-variant rounded-lg p-sm flex items-center gap-md min-w-[200px]">
          <div className="flex-1">
            <div className="flex justify-between mb-xs">
              <span className="text-label-md text-on-surface-variant uppercase tracking-wider">Total Weightage</span>
              <span className={cn("text-title-md font-bold", totalWeight === 100 ? "text-primary" : "text-error")}>
                {totalWeight}%
              </span>
            </div>
            <div className="w-full bg-surface-variant rounded-full h-1.5">
              <div
                className={cn("h-1.5 rounded-full", totalWeight === 100 ? "bg-primary" : "bg-error")}
                style={{ width: `${Math.min(totalWeight, 100)}%` }}
              />
            </div>
          </div>
          <span className={cn("material-symbols-outlined", totalWeight === 100 ? "text-tertiary-container" : "text-error")}>
            {totalWeight === 100 ? "check_circle" : "warning"}
          </span>
        </div>
      </div>

      {/* Goals */}
      <div className="space-y-md">
        {goals.length === 0 ? (
          <div className="text-center py-xl text-on-surface-variant">No goals in this sheet</div>
        ) : (
          goals.map((goal: any) => (
            <article key={goal.id} className={cn(
              "bg-surface border border-outline-variant rounded-lg p-lg shadow-level-1 hover:shadow-level-2 transition-shadow",
              !goal.isAligned && "border-l-4 border-l-error"
            )}>
              <div className="flex justify-between items-start mb-sm">
                <span className="bg-surface-container text-on-surface-variant text-label-md px-2 py-1 rounded border border-outline-variant/50">
                  {goal.uom ?? "General"}
                </span>
                <span className={cn(
                  "text-label-md px-2 py-1 rounded flex items-center gap-xs",
                  goal.isAligned !== false
                    ? "bg-tertiary-container/10 text-tertiary"
                    : "bg-error-container text-on-error-container"
                )}>
                  <span className="material-symbols-outlined text-[14px]">
                    {goal.isAligned !== false ? "verified" : "warning"}
                  </span>
                  {goal.isAligned !== false ? "Department Aligned" : "Out of Alignment"}
                </span>
              </div>
              <h3 className="text-title-lg text-on-surface mb-md">{goal.title}</h3>
              {goal.isAligned === false && goal.alignmentNote && (
                <p className="text-body-md text-error mb-md">{goal.alignmentNote}</p>
              )}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-md pt-md border-t border-outline-variant">
                <div>
                  <label className="text-label-md text-on-surface-variant block mb-xs">Target Measure</label>
                  <p className="text-body-md text-on-surface">{goal.targetValue ?? "—"}</p>
                </div>
                <div className="border-l border-outline-variant/50 pl-md hidden md:block">
                  <label className="text-label-md text-on-surface-variant block mb-xs">Weightage</label>
                  <p className="text-title-md text-on-surface">{goal.weightage ?? 0}%</p>
                </div>
              </div>
            </article>
          ))
        )}
      </div>

      {/* Sticky action bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-surface border-t border-outline-variant p-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-20">
        <div className="max-w-4xl mx-auto flex flex-col gap-sm">
          <textarea
            rows={2}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Add notes for rework (required to return)..."
            className="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-body-md text-on-surface p-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none"
          />
          <div className="flex justify-end gap-md">
            <button
              onClick={handleRework}
              disabled={!comment.trim() || returnForRework.isPending}
              className="px-xl py-2 rounded text-title-md border border-outline-variant text-on-surface bg-surface hover:bg-surface-container-low transition-colors flex items-center gap-sm active:scale-95 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">undo</span>
              Return for Rework
            </button>
            <button
              onClick={handleApprove}
              disabled={approveSheet.isPending}
              className="px-xl py-2 rounded text-title-md text-on-primary bg-primary hover:bg-primary-container transition-colors shadow-level-1 flex items-center gap-sm active:scale-95 border-t border-white/20 disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[20px]">check</span>
              Approve Goals
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
