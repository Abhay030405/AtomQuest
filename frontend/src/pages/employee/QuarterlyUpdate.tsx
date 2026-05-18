import { useMemo, useState } from "react";
import { useCycleStore } from "@/store/cycleStore";
import {
  useMyQuarter,
  useBulkLogAchievements,
  useResubmitAchievement,
} from "@/hooks/useAchievements";
import {
  AchievementStatus,
  ACHIEVEMENT_STATUS_LABEL,
  Quarter,
  type AchievementInput,
} from "@/services/achievement.service";
import { UOM_TYPE_META } from "@/constants";
import type { UoMType } from "@/types/goal.types";
import { toast } from "sonner";

const QUARTERS: { id: Quarter; label: string }[] = [
  { id: Quarter.Q1, label: "Q1" },
  { id: Quarter.Q2, label: "Q2" },
  { id: Quarter.Q3, label: "Q3" },
  { id: Quarter.Q4, label: "Q4" },
];

const STATUS_OPTIONS: AchievementStatus[] = [
  AchievementStatus.NOT_STARTED,
  AchievementStatus.ON_TRACK,
  AchievementStatus.COMPLETED,
];

const STATUS_CHIP: Record<AchievementStatus, string> = {
  not_started: "bg-surface-variant text-on-surface-variant",
  on_track: "bg-tertiary-container text-on-tertiary-container",
  completed: "bg-emerald-100 text-emerald-700",
};

interface DraftEntry {
  status: AchievementStatus;
  actualValueRaw: string; // raw text, validated on submit
  actualDate: string;     // YYYY-MM-DD or ""
  editReason: string;     // only used when an achievement exists already
}

function emptyDraft(): DraftEntry {
  return { status: AchievementStatus.NOT_STARTED, actualValueRaw: "", actualDate: "", editReason: "" };
}

export default function QuarterlyUpdate() {
  const { activeWindow } = useCycleStore();
  const cycleId = activeWindow?.id;

  const [quarter, setQuarter] = useState<Quarter>(Quarter.Q1);

  const { data: quarterView, isLoading } = useMyQuarter(quarter, cycleId);
  const bulkLog = useBulkLogAchievements(quarter, cycleId);
  const resubmit = useResubmitAchievement(quarter, cycleId);

  const goalEntries = useMemo(() => quarterView?.goals ?? [], [quarterView]);

  // Local drafts keyed by goalId. Initialised lazily from server data on first
  // edit; otherwise the inputs reflect the saved achievement values directly.
  const [drafts, setDrafts] = useState<Record<string, DraftEntry>>({});

  const draftFor = (goalId: string): DraftEntry => {
    if (drafts[goalId]) return drafts[goalId];
    const entry = goalEntries.find((g) => g.goalId === goalId);
    if (!entry || !entry.achievement) return emptyDraft();
    return {
      status: entry.achievement.status,
      actualValueRaw:
        entry.achievement.actualValue !== null
          ? String(entry.achievement.actualValue)
          : "",
      actualDate: entry.achievement.actualDate ?? "",
      editReason: "",
    };
  };

  const updateDraft = (goalId: string, patch: Partial<DraftEntry>) => {
    setDrafts((prev) => {
      const current = prev[goalId] ?? draftFor(goalId);
      return { ...prev, [goalId]: { ...current, ...patch } };
    });
  };

  // ─── Summary stats ──────────────────────────────────────────────────────────
  const completedCount = goalEntries.filter(
    (g) => g.achievement?.status === AchievementStatus.COMPLETED
  ).length;

  // Weighted average over only the *scored* goals (those with a computed_score).
  // This mirrors the build-plan rule: don't penalise the employee for goals
  // that haven't been scored yet — divide by the sum of *scored* weightages,
  // not by 100.
  const avgScore = useMemo(() => {
    let numer = 0;
    let denom = 0;
    for (const g of goalEntries) {
      const s = g.achievement?.computedScore;
      if (s === null || s === undefined) continue;
      numer += s * g.weightage;
      denom += g.weightage;
    }
    if (denom === 0) return null;
    return Math.round(numer / denom);
  }, [goalEntries]);

  // ─── Check-in status derived from achievement submitted_at ────────────────
  // We don't yet have an employee-facing "my-checkin" endpoint, so for now
  // "Reviewed" maps to "every submitted achievement has a computed_score AND
  // the cycle phase has advanced past the current quarter" — a simple proxy.
  // Until that endpoint exists, only Not sent / Awaiting manager response
  // can be reliably distinguished.
  const checkinStatus = useMemo(() => {
    const submitted = goalEntries.filter((g) => g.achievement?.submittedAt);
    if (submitted.length === 0) return "Not sent";
    return "Awaiting manager response";
  }, [goalEntries]);

  // Card 4: "Q1 — <cycle name we gave to that quarter>"
  const quarterTitle = useMemo(() => {
    const q = quarter.toUpperCase();
    const name = activeWindow?.cycleName ?? "Current Cycle";
    return `${q} — ${name}`;
  }, [quarter, activeWindow]);

  // ─── Submit handler ─────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (goalEntries.length === 0) {
      toast.error("No approved goals to update");
      return;
    }
    const toCreate: AchievementInput[] = [];
    const toResubmit: { id: string; draft: DraftEntry; isTimeline: boolean }[] = [];

    for (const entry of goalEntries) {
      const draft = drafts[entry.goalId];
      if (!draft) continue; // user didn't touch this goal — skip
      if (entry.sourceSharedGoalId) continue; // managed by goal owner — not submittable
      const isTimeline = entry.uomType === "TIMELINE";
      // Reject obvious invalid inputs early so we don't get backend 422s.
      if (draft.status !== AchievementStatus.NOT_STARTED) {
        if (isTimeline && !draft.actualDate) {
          toast.error(`"${entry.title}": actual date required`);
          return;
        }
        if (!isTimeline && draft.actualValueRaw.trim() === "") {
          toast.error(`"${entry.title}": actual value required`);
          return;
        }
      }
      const parsed: AchievementInput = {
        goalId: entry.goalId,
        quarter,
        actualValue:
          !isTimeline && draft.actualValueRaw.trim() !== ""
            ? Number(draft.actualValueRaw)
            : null,
        actualDate: isTimeline && draft.actualDate ? draft.actualDate : null,
        status: draft.status,
      };
      if (parsed.actualValue !== null && Number.isNaN(parsed.actualValue)) {
        toast.error(`"${entry.title}": actual value must be a number`);
        return;
      }
      if (entry.achievement) {
        toResubmit.push({ id: entry.achievement.id, draft, isTimeline: entry.uomType === "TIMELINE" });
      } else {
        toCreate.push(parsed);
      }
    }

    if (toCreate.length === 0 && toResubmit.length === 0) {
      toast.info("Nothing to submit — edit a goal first");
      return;
    }

    // Resubmissions require an edit_reason (≥10 chars). Block early if any
    // touched-existing-achievement lacks a reason.
    for (const r of toResubmit) {
      if (r.draft.editReason.trim().length < 10) {
        toast.error("Each updated entry needs a reason (10+ chars) for edits");
        return;
      }
    }

    try {
      if (toCreate.length > 0) {
        await bulkLog.mutateAsync(toCreate);
      }
      for (const r of toResubmit) {
        await resubmit.mutateAsync({
          achievementId: r.id,
          actualValue:
            !r.isTimeline && r.draft.actualValueRaw.trim() !== ""
              ? Number(r.draft.actualValueRaw)
              : null,
          actualDate: r.isTimeline && r.draft.actualDate ? r.draft.actualDate : null,
          status: r.draft.status,
          editReason: r.draft.editReason.trim(),
        });
      }
      setDrafts({});
    } catch {
      // toast already shown by mutation onError
    }
  };

  const isSubmitting = bulkLog.isPending || resubmit.isPending;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg text-on-surface">Quarterly Progress Update</h1>
          <p className="text-body-md text-on-surface-variant mt-xs">Update your actuals and status for locked goals.</p>
        </div>
        <div
          role="tablist"
          aria-label="Select quarter"
          className="inline-flex p-1 rounded-lg bg-surface-container-low border border-outline-variant shadow-level-1"
        >
          {QUARTERS.map((q) => {
            const active = q.id === quarter;
            return (
              <button
                key={q.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setQuarter(q.id)}
                className={
                  "px-md py-1.5 text-label-lg font-medium rounded-md transition-colors " +
                  (active
                    ? "bg-primary text-on-primary shadow-level-1"
                    : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container")
                }
              >
                {q.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-md">
        {/* 1. Goals Completed — count, no progress bar */}
        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-primary">check_circle</span>
            <h2 className="text-title-md">Goals Completed</h2>
          </div>
          <div className="flex items-baseline gap-sm">
            <span className="text-display-lg text-on-surface">{completedCount}</span>
            <span className="text-body-md text-on-surface-variant">of {goalEntries.length}</span>
          </div>
        </div>

        {/* 2. Avg Score So Far — weighted by goal weightage, over scored goals only */}
        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-tertiary">trending_up</span>
            <h2 className="text-title-md">Avg Score So Far</h2>
          </div>
          <div className="flex items-baseline gap-sm">
            <span className="text-display-lg text-on-surface">
              {avgScore === null ? "—" : `${avgScore}%`}
            </span>
            <span className="text-body-md text-on-surface-variant">weighted</span>
          </div>
        </div>

        {/* 3. Check-in Status — derived from achievement submissions */}
        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-secondary">forum</span>
            <h2 className="text-title-md">Check-in Status</h2>
          </div>
          <div className="flex items-baseline gap-sm">
            <span className="text-title-lg text-on-surface">{checkinStatus}</span>
          </div>
        </div>

        {/* 4. Quarter + cycle title */}
        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-secondary">calendar_month</span>
            <h2 className="text-title-md">Quarter</h2>
          </div>
          <div className="flex items-baseline gap-sm">
            <span className="text-title-lg text-on-surface">{quarterTitle}</span>
          </div>
        </div>
      </div>

      {/* Goal list + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Goals column */}
        <div className="lg:col-span-2 space-y-md">
          <h2 className="text-title-lg text-on-surface mb-sm">Approved Goals</h2>

          {isLoading ? (
            <div className="space-y-md">
              {[1, 2].map((i) => (
                <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant h-40 animate-pulse" />
              ))}
            </div>
          ) : goalEntries.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">lock</span>
              <p className="text-body-lg text-on-surface-variant mt-md">No approved goals to update yet.</p>
            </div>
          ) : (
            goalEntries.map((entry) => {
              const draft = draftFor(entry.goalId);
              const isTimeline = entry.uomType === "TIMELINE";
              const hasAchievement = entry.achievement !== null;
              const score = entry.achievement?.computedScore;
              const isShared = Boolean(entry.sourceSharedGoalId);
              return (
                <div key={entry.goalId} className={`bg-surface-container-lowest rounded-xl border shadow-level-1 overflow-hidden ${isShared ? "border-outline-variant opacity-75" : "border-outline-variant"}`}>
                  <div className="p-md border-b border-outline-variant bg-surface-container-low flex justify-between items-start gap-md">
                    <div className="min-w-0">
                      <div className="flex items-center gap-xs mb-xs">
                        <span className="material-symbols-outlined text-secondary text-[16px]">lock</span>
                        <span className="text-label-md text-secondary">{UOM_TYPE_META[entry.uomType as UoMType]?.label ?? entry.uomType}</span>
                        <span className="text-label-md text-on-surface-variant">• Weightage {entry.weightage}%</span>
                        {isShared && (
                          <span className="inline-flex items-center gap-xs px-2 py-0.5 rounded bg-surface-variant text-on-surface-variant text-label-sm">
                            <span className="material-symbols-outlined text-[14px]">share</span>
                            <span>Managed by goal owner</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-title-lg text-on-surface truncate">{entry.title}</h3>
                    </div>
                    <span className={`inline-flex items-center px-2 py-1 rounded text-label-md shrink-0 ${STATUS_CHIP[draft.status]}`}>
                      {ACHIEVEMENT_STATUS_LABEL[draft.status]}
                    </span>
                  </div>

                  <div className="p-md grid grid-cols-1 md:grid-cols-2 gap-md">
                    <div>
                      <label className="text-label-md text-on-surface-variant block mb-xs">Status</label>
                      <select
                        value={draft.status}
                        disabled={isShared}
                        onChange={(e) => !isShared && updateDraft(entry.goalId, { status: e.target.value as AchievementStatus })}
                        className={`w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg px-sm py-2 ${isShared ? "opacity-60 cursor-not-allowed" : "focus:ring-2 focus:ring-primary focus:border-primary"}`}
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s} value={s}>{ACHIEVEMENT_STATUS_LABEL[s]}</option>
                        ))}
                      </select>
                    </div>
                    <div className="flex gap-sm">
                      <div className="flex-1">
                        <label className="text-label-md text-on-surface-variant block mb-xs">Target</label>
                        <div className="w-full bg-surface-container-high border border-outline-variant text-on-surface-variant text-body-md rounded-lg px-sm py-2">
                          {isTimeline
                            ? entry.targetDate ?? "—"
                            : entry.targetValue ?? "—"}
                        </div>
                      </div>
                      <div className="flex-1">
                        <label className="text-label-md text-on-surface-variant block mb-xs">
                          {isTimeline ? "Actual date" : "Actual value"}
                        </label>
                        {isTimeline ? (
                          <input
                            type="date"
                            value={draft.actualDate}
                            disabled={isShared}
                            onChange={(e) => !isShared && updateDraft(entry.goalId, { actualDate: e.target.value })}
                            className={`w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg px-sm py-2 ${isShared ? "opacity-60 cursor-not-allowed" : "focus:ring-2 focus:ring-primary focus:border-primary"}`}
                          />
                        ) : (
                          <input
                            type="number"
                            inputMode="decimal"
                            value={draft.actualValueRaw}
                            disabled={isShared}
                            onChange={(e) => !isShared && updateDraft(entry.goalId, { actualValueRaw: e.target.value })}
                            placeholder={isShared ? "Managed by goal owner" : "Enter actual"}
                            className={`w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg px-sm py-2 ${isShared ? "opacity-60 cursor-not-allowed" : "focus:ring-2 focus:ring-primary focus:border-primary"}`}
                          />
                        )}
                      </div>
                    </div>
                  </div>

                  {hasAchievement && (
                    <div className="px-md pb-md">
                      <div className="flex justify-between text-label-md text-on-surface-variant mb-xs">
                        <span>Computed score</span>
                        <span>{score !== null && score !== undefined ? `${score}` : "—"}</span>
                      </div>
                      {drafts[entry.goalId] && (
                        <div className="mt-sm">
                          <label className="text-label-md text-on-surface-variant block mb-xs">
                            Reason for edit (required, 10+ chars)
                          </label>
                          <input
                            type="text"
                            value={draft.editReason}
                            onChange={(e) => updateDraft(entry.goalId, { editReason: e.target.value })}
                            placeholder="Why are you updating this?"
                            className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-sm py-2"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-md">
          <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1 flex flex-col gap-sm">
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSubmitting || goalEntries.length === 0}
              className="w-full bg-primary text-on-primary text-title-md rounded-lg py-2 px-md hover:opacity-90 transition-all border-t border-white/20 shadow-level-1 flex items-center justify-center gap-xs disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <span className="material-symbols-outlined text-[20px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[20px]">send</span>
              )}
              Submit for Review
            </button>
            <p className="text-label-md text-on-surface-variant text-center mt-xs">
              {Object.keys(drafts).length === 0
                ? "No unsaved changes"
                : `${Object.keys(drafts).length} goal(s) edited`}
            </p>
          </div>

          <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1">
            <h2 className="text-title-md text-on-surface mb-sm flex items-center gap-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">insights</span>
              Performance Trends
            </h2>
            <div className="h-48 bg-surface-container-low rounded border border-outline-variant flex items-center justify-center">
              <span className="text-body-md text-on-surface-variant">Chart coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
