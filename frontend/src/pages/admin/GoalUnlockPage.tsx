import { useState, useMemo } from "react";
import { useAllGoals } from "@/hooks/useGoals";
import { useAdminAuditLog, useUnlockGoal } from "@/hooks/useAdmin";
import { USERS_BY_ID } from "@/mocks/mockUsers";
import { GoalStatus, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { timeAgo } from "@/utils/date.util";
import { AuditAction } from "@/types/audit.types";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";

function UnlockDialog({ goal, open, onClose }: { goal: Goal | null; open: boolean; onClose: () => void }) {
  const [reason, setReason] = useState("");
  const unlock = useUnlockGoal();
  const isValid = reason.trim().length >= 30;
  const user = goal ? USERS_BY_ID[goal.userId] : null;

  function handleConfirm() {
    if (!goal || !isValid) return;
    unlock.mutate(goal.id, { onSuccess: () => { setReason(""); onClose(); } });
  }

  function handleClose() { setReason(""); onClose(); }
  if (!goal) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-title-lg text-on-surface flex items-center gap-sm">
            <span className="material-symbols-outlined text-error">lock_open_right</span>
            Unlock Goal
          </DialogTitle>
          <DialogDescription className="text-body-md text-on-surface-variant">
            This will set the goal back to <strong className="text-on-surface">Approved</strong> so the employee can resume editing. This action is permanently logged.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-md py-sm">
          <div className="rounded-lg border border-outline-variant p-md bg-surface-container space-y-xs">
            <p className="text-title-md text-on-surface">{goal.title}</p>
            <p className="text-label-md text-on-surface-variant">
              {user?.fullName ?? "Unknown"} · Locked {goal.lockedAt ? timeAgo(goal.lockedAt) : ""}
            </p>
          </div>

          <div className="space-y-xs">
            <label className="text-label-md text-on-surface block">
              Reason for unlocking *{" "}
              <span className={cn("text-[10px]", isValid ? "text-tertiary" : "text-on-surface-variant")}>
                ({reason.trim().length}/30 min)
              </span>
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Describe why this goal needs to be unlocked…"
              className="w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
            />
            {!isValid && reason.length > 0 && (
              <p className="text-label-md text-error">Please provide at least 30 characters.</p>
            )}
          </div>
        </div>

        <DialogFooter className="gap-sm">
          <button
            onClick={handleClose}
            className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            disabled={!isValid || unlock.isPending}
            onClick={handleConfirm}
            className="bg-error text-on-error text-label-md px-md py-sm rounded-lg hover:opacity-90 transition-opacity flex items-center gap-xs disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[18px]">lock_open</span>
            {unlock.isPending ? "Unlocking…" : "Confirm Unlock"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default function GoalUnlockPage() {
  const { data: allGoals = [], isLoading: goalsLoading } = useAllGoals();
  const { data: auditPage, isLoading: auditLoading } = useAdminAuditLog({ pageSize: 100 });

  const [search, setSearch] = useState("");
  const [unlockTarget, setUnlockTarget] = useState<Goal | null>(null);

  const lockedGoals = (allGoals as Goal[]).filter((g) => g.status === GoalStatus.LOCKED);

  const filtered = useMemo(() => {
    if (!search) return lockedGoals;
    const q = search.toLowerCase();
    return lockedGoals.filter((g) => {
      const user = USERS_BY_ID[g.userId];
      return g.title.toLowerCase().includes(q) || (user?.fullName.toLowerCase().includes(q) ?? false);
    });
  }, [lockedGoals, search]);

  const recentUnlocks = (auditPage?.items ?? [])
    .filter((l: any) => l.action === AuditAction.UPDATE && l.fieldName === "status" && l.newValue === GoalStatus.APPROVED)
    .slice(0, 5);

  const isLoading = goalsLoading;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="border-b border-outline-variant pb-md">
        <h2 className="text-headline-lg text-on-surface">Exception Handling: Unlock Goals</h2>
        <p className="text-body-lg text-on-surface-variant mt-xs">
          Unlock approved/locked goals for mid-cycle revisions. All actions are permanently logged in the audit trail.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Locked goals list (2/3) */}
        <div className="lg:col-span-2 space-y-md">
          {/* Search */}
          <div className="relative">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">search</span>
            <input
              type="text"
              placeholder="Search by goal title or employee name…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-xl pr-sm py-sm bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all"
            />
            {search && (
              <button onClick={() => setSearch("")} className="absolute right-sm top-1/2 -translate-y-1/2 text-on-surface-variant hover:text-on-surface">
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            )}
          </div>

          {!isLoading && (
            <p className="text-label-md text-on-surface-variant">
              {lockedGoals.length} locked goal{lockedGoals.length !== 1 ? "s" : ""}
              {search && ` · ${filtered.length} match${filtered.length !== 1 ? "es" : ""}`}
            </p>
          )}

          {/* Goal list */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
            {isLoading ? (
              <div className="p-lg space-y-md">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-container-low rounded-lg animate-pulse" />)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="p-xl text-center">
                <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">lock</span>
                <p className="text-body-md text-on-surface-variant mt-md">
                  {search ? "No matching locked goals" : "No locked goals — all goals are currently unlocked"}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-outline-variant/50">
                {filtered.map((goal) => {
                  const user = USERS_BY_ID[goal.userId];
                  const uomMeta = UOM_TYPE_META[goal.uomType];
                  const initials = (user?.fullName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  return (
                    <div key={goal.id} className="flex items-center gap-md p-md hover:bg-surface-container-low transition-colors">
                      <div className="w-8 h-8 rounded-full bg-surface-container text-on-surface-variant flex items-center justify-center text-label-md shrink-0">
                        {initials}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-title-md text-on-surface truncate">{goal.title}</p>
                        <p className="text-label-md text-on-surface-variant">
                          {user?.fullName ?? "Unknown"} · {formatThrustArea(goal.thrustArea)} · {uomMeta?.label ?? goal.uomType} · Target: {goal.targetValue ?? "—"}
                        </p>
                      </div>
                      <span className="text-label-md text-on-surface-variant shrink-0">{goal.weightage}%</span>
                      <span className="bg-tertiary/10 text-tertiary text-label-md px-2 py-1 rounded-md flex items-center gap-xs shrink-0">
                        <span className="material-symbols-outlined text-[14px]">lock</span>
                        Locked
                      </span>
                      <button
                        onClick={() => setUnlockTarget(goal)}
                        className="bg-error-container text-on-error-container text-label-md px-sm py-xs rounded border border-error/20 hover:opacity-90 transition-opacity flex items-center gap-xs shrink-0"
                      >
                        <span className="material-symbols-outlined text-[14px]">lock_open</span>
                        Unlock
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right panel (1/3) */}
        <div className="space-y-md">
          {/* Recent unlocks */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1">
            <div className="p-lg border-b border-outline-variant">
              <h3 className="text-title-md text-on-surface">Recent Unlocks</h3>
            </div>
            <div className="p-lg">
              {auditLoading ? (
                <div className="space-y-sm">
                  {[1, 2].map((i) => <div key={i} className="h-10 bg-surface-container-low rounded animate-pulse" />)}
                </div>
              ) : recentUnlocks.length === 0 ? (
                <p className="text-label-md text-on-surface-variant text-center py-md">No unlock events recorded.</p>
              ) : (
                <div className="space-y-md">
                  {recentUnlocks.map((log: any) => (
                    <div key={log.id} className="flex items-start gap-sm">
                      <div className="w-6 h-6 rounded-full bg-error/10 flex items-center justify-center shrink-0 mt-xs">
                        <span className="material-symbols-outlined text-error text-[14px]">lock_open</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-body-md text-on-surface font-medium">{log.actorName}</p>
                        <p className="text-label-md text-on-surface-variant">unlocked {log.tableName}</p>
                        <p className="text-label-md text-outline">{timeAgo(log.changedAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Warning card */}
          <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 p-lg flex gap-md">
            <div className="w-8 h-8 rounded-full bg-error/10 flex items-center justify-center shrink-0 mt-xs">
              <span className="material-symbols-outlined text-error text-[18px]">warning</span>
            </div>
            <div>
              <p className="text-title-md text-on-surface mb-xs">Use with care</p>
              <p className="text-body-md text-on-surface-variant leading-relaxed">
                Unlocking a goal allows the employee to edit targets that were locked after the cycle deadline. All unlock actions are permanently logged in the audit trail.
              </p>
            </div>
          </div>
        </div>
      </div>

      <UnlockDialog
        goal={unlockTarget}
        open={unlockTarget !== null}
        onClose={() => setUnlockTarget(null)}
      />
    </div>
  );
}
