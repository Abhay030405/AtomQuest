import { useState } from "react";
import { useTeamSheets, useApproveSheet, useReturnForRework } from "@/hooks/useApprovals";
import { useCycleStore } from "@/store/cycleStore";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export default function ApprovalQueuePage() {
  const { activeWindow } = useCycleStore();
  const { data: teamSheets = [], isLoading } = useTeamSheets(activeWindow?.id ?? "");
  const approveSheet = useApproveSheet();
  const returnForRework = useReturnForRework();

  const pendingSheets = teamSheets.filter((s: any) => s.status === "submitted" || s.status === "under_review");

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [reworkComment, setReworkComment] = useState("");

  const selected = pendingSheets.find((s: any) => s.id === selectedId) ?? pendingSheets[0] ?? null;

  const initials = (name: string) =>
    (name ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();

  const totalWeight = selected?.goals?.reduce((sum: number, g: any) => sum + (g.weightage ?? 0), 0) ?? 0;

  async function handleApprove() {
    if (!selected) return;
    try {
      await approveSheet.mutateAsync(selected.id);
      toast.success("Goal sheet approved");
      setSelectedId(null);
    } catch {
      toast.error("Failed to approve");
    }
  }

  async function handleRework() {
    if (!selected || !reworkComment.trim()) return;
    try {
      await returnForRework.mutateAsync({ sheetId: selected.id, reason: reworkComment });
      toast.success("Returned for rework");
      setReworkComment("");
      setSelectedId(null);
    } catch {
      toast.error("Failed to return for rework");
    }
  }

  return (
    <div className="p-lg flex flex-col lg:flex-row gap-lg bg-surface h-[calc(100vh-64px)] overflow-hidden">
      {/* LEFT PANEL: Submissions list */}
      <section className="w-full lg:w-1/3 max-w-sm flex flex-col bg-surface border border-outline-variant rounded-lg shadow-level-1 overflow-hidden">
        {/* List header */}
        <div className="px-md py-lg border-b border-outline-variant bg-surface-container-lowest flex justify-between items-center">
          <div>
            <h2 className="text-title-lg text-on-surface">Submissions</h2>
            <p className="text-body-md text-on-surface-variant">Pending your review</p>
          </div>
          <span className="bg-primary-container text-on-primary-container text-label-md px-2 py-1 rounded-full">
            {pendingSheets.length}
          </span>
        </div>

        {/* List items */}
        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-lg space-y-md">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-surface-container-low rounded-lg animate-pulse" />)}
            </div>
          ) : pendingSheets.length === 0 ? (
            <div className="p-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">inbox</span>
              <p className="text-body-md text-on-surface-variant mt-md">No pending submissions</p>
            </div>
          ) : (
            pendingSheets.map((sheet: any) => {
              const isSelected = (selected?.id ?? pendingSheets[0]?.id) === sheet.id;
              return (
                <button
                  key={sheet.id}
                  onClick={() => setSelectedId(sheet.id)}
                  className={cn(
                    "w-full px-md py-md border-b border-outline-variant border-l-4 cursor-pointer transition-colors text-left",
                    isSelected
                      ? "border-l-primary bg-primary-fixed/20"
                      : "border-l-transparent hover:bg-surface-container-low"
                  )}
                >
                  <div className="flex items-center gap-md">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-title-md shrink-0">
                      {initials(sheet.employeeName ?? "")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-title-md text-on-surface truncate">{sheet.employeeName ?? "Unknown"}</h3>
                      <p className="text-body-md text-on-surface-variant truncate">{sheet.employeeRole ?? "—"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="text-label-md text-on-surface-variant block">Submitted</span>
                      <span className="text-body-md text-on-surface block">
                        {sheet.submittedAt ? new Date(sheet.submittedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                      </span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </section>

      {/* RIGHT PANEL: Detail view */}
      {selected ? (
        <section className="flex-1 flex flex-col bg-surface border border-outline-variant rounded-lg shadow-level-1 overflow-hidden relative">
          {/* Detail header */}
          <div className="px-lg py-lg border-b border-outline-variant bg-surface-container-lowest shrink-0">
            <div className="flex justify-between items-start mb-md">
              <div className="flex items-center gap-md">
                <div className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-headline-md font-bold shrink-0 border border-outline-variant">
                  {initials((selected as any).employeeName ?? "")}
                </div>
                <div>
                  <h2 className="text-headline-md text-on-surface">{(selected as any).employeeName}'s Goals</h2>
                  <p className="text-body-md text-on-surface-variant">{(selected as any).employeeRole ?? "—"}</p>
                </div>
              </div>
              {/* Weightage indicator */}
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
          </div>

          {/* Goals list */}
          <div className="flex-1 overflow-y-auto p-lg bg-surface">
            <div className="flex flex-col gap-md max-w-4xl mx-auto">
              {(selected.goals ?? []).length === 0 ? (
                <div className="text-center py-xl text-on-surface-variant">No goals found in this sheet</div>
              ) : (
                (selected.goals ?? []).map((goal: any) => (
                  <article key={goal.id} className="bg-surface border border-outline-variant rounded-lg p-lg shadow-level-1 hover:shadow-level-2 transition-shadow">
                    <div className="flex justify-between items-start mb-sm">
                      <span className="bg-surface-container text-on-surface-variant text-label-md px-2 py-1 rounded border border-outline-variant/50">
                        {goal.uom ?? "General"}
                      </span>
                      <span className={cn(
                        "text-label-md px-2 py-1 rounded flex items-center gap-xs",
                        goal.isAligned
                          ? "bg-tertiary-container/10 text-tertiary"
                          : "bg-error-container text-on-error-container"
                      )}>
                        <span className="material-symbols-outlined text-[14px]">
                          {goal.isAligned ? "verified" : "warning"}
                        </span>
                        {goal.isAligned ? "Department Aligned" : "Out of Alignment"}
                      </span>
                    </div>
                    <h3 className="text-title-lg text-on-surface mb-md">{goal.title}</h3>
                    {!goal.isAligned && goal.alignmentNote && (
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
            <div className="h-32" />
          </div>

          {/* Action bar */}
          <div className="absolute bottom-0 left-0 right-0 bg-surface border-t border-outline-variant p-lg shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div className="max-w-4xl mx-auto flex flex-col gap-sm">
              <textarea
                rows={2}
                value={reworkComment}
                onChange={(e) => setReworkComment(e.target.value)}
                placeholder="Add notes for rework (required to return)..."
                className="w-full bg-surface-container-lowest border border-outline-variant rounded-md text-body-md text-on-surface p-sm focus:border-primary focus:ring-1 focus:ring-primary/20 transition-all resize-none"
              />
              <div className="flex justify-end gap-md">
                <button
                  onClick={handleRework}
                  disabled={!reworkComment.trim() || returnForRework.isPending}
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
        </section>
      ) : (
        <section className="flex-1 flex items-center justify-center bg-surface border border-outline-variant rounded-lg">
          <div className="text-center">
            <span className="material-symbols-outlined text-[64px] text-on-surface-variant/30">task_alt</span>
            <p className="text-body-lg text-on-surface-variant mt-md">Select a submission to review</p>
          </div>
        </section>
      )}
    </div>
  );
}
