import { useState } from "react";
import { useDirectReports } from "@/hooks/useApprovals";
import { useCycleStore } from "@/store/cycleStore";
import {
  useTeamCheckinStatus,
  useEmployeeCheckinDetail,
  useCreateCheckin,
  useUpdateCheckin,
} from "@/hooks/useCheckins";
import {
  CheckinCommentType,
  CheckinRatingSentiment,
  SENTIMENT_LABEL,
  SENTIMENT_CHIP,
} from "@/services/checkin.service";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import type { UoMType } from "@/types/goal.types";
import type { User } from "@/types/user.types";

// ─── Quarter tabs ─────────────────────────────────────────────────────────────

const QUARTERS = [
  { id: "q1", label: "Q1" },
  { id: "q2", label: "Q2" },
  { id: "q3", label: "Q3" },
  { id: "q4", label: "Q4" },
] as const;
type QuarterKey = (typeof QUARTERS)[number]["id"];

// ─── Sentiment options ────────────────────────────────────────────────────────

const SENTIMENT_OPTIONS = [
  { value: CheckinRatingSentiment.POSITIVE, icon: "sentiment_satisfied", label: SENTIMENT_LABEL.positive },
  { value: CheckinRatingSentiment.NEUTRAL,  icon: "sentiment_neutral",   label: SENTIMENT_LABEL.neutral  },
  { value: CheckinRatingSentiment.NEEDS_ATTENTION, icon: "sentiment_dissatisfied", label: SENTIMENT_LABEL.needs_attention },
];

// ─── Status badge helper ──────────────────────────────────────────────────────

function StatusPill({ done, label }: Readonly<{ done: boolean; label: string }>) {
  return (
    <span
      className={`inline-flex items-center gap-xs px-2 py-0.5 rounded text-label-sm ${
        done
          ? "bg-tertiary-container text-on-tertiary-container"
          : "bg-surface-variant text-on-surface-variant"
      }`}
    >
      <span className="material-symbols-outlined text-[13px]">
        {done ? "check_circle" : "radio_button_unchecked"}
      </span>
      {label}
    </span>
  );
}

// ─── Goal table row (extracted to reduce CheckinPanel complexity) ───────────

interface GoalTableRowProps {
  g: import("@/services/checkin.service").CheckinGoalEntry;
  isSelected: boolean;
  onToggle: (id: string) => void;
}

function scoreColorClass(score: number | null | undefined): string {
  if (score === null || score === undefined) return "text-on-surface-variant";
  if (score >= 80) return "text-tertiary";
  if (score >= 50) return "text-secondary";
  return "text-error";
}

function GoalTableRow({ g, isSelected, onToggle }: Readonly<GoalTableRowProps>) {
  const meta = UOM_TYPE_META[g.uomType as UoMType];
  const isTimeline = g.uomType === "TIMELINE";

  let targetLabel: string;
  if (isTimeline) {
    targetLabel = g.targetDate ?? "—";
  } else if (g.targetValue === null) {
    targetLabel = "—";
  } else {
    targetLabel = String(g.targetValue);
  }

  let actualLabel: string;
  if (isTimeline) {
    actualLabel = g.achievement?.actualDate ?? "—";
  } else if (g.achievement?.actualValue !== null && g.achievement?.actualValue !== undefined) {
    actualLabel = String(g.achievement.actualValue);
  } else {
    actualLabel = "—";
  }

  const score = g.achievement?.computedScore;
  const hasActual = g.achievement?.actualValue !== null || Boolean(g.achievement?.actualDate);

  return (
    <tr key={g.id} className={`border-b border-outline-variant last:border-0 ${isSelected ? "bg-primary/5" : ""}`}>
      <td className="px-md py-sm">
        <p className="text-body-sm text-on-surface font-medium truncate max-w-[180px]">{g.title}</p>
        <p className="text-label-sm text-on-surface-variant">{g.weightage}%</p>
      </td>
      <td className="px-md py-sm hidden sm:table-cell">
        <span className="text-label-sm text-on-surface-variant">{meta?.label ?? g.uomType}</span>
      </td>
      <td className="px-md py-sm text-right text-body-sm text-on-surface">{targetLabel}</td>
      <td className="px-md py-sm text-right">
        <span className={`text-body-sm font-medium ${hasActual ? "text-on-surface" : "text-on-surface-variant"}`}>
          {actualLabel}
        </span>
      </td>
      <td className="px-md py-sm text-right hidden sm:table-cell">
        <span className={`text-body-sm font-semibold ${scoreColorClass(score)}`}>
          {score !== null && score !== undefined ? `${score}%` : "—"}
        </span>
      </td>
      <td className="px-md py-sm text-center">
        <button
          type="button"
          onClick={() => onToggle(g.id)}
          aria-label={isSelected ? "Remove from discussion" : "Add to discussion"}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            isSelected
              ? "bg-primary border-primary"
              : "border-outline-variant bg-surface-container-lowest"
          }`}
        >
          {isSelected && (
            <span className="material-symbols-outlined text-on-primary text-[14px]">check</span>
          )}
        </button>
      </td>
    </tr>
  );
}

// ─── Employee check-in panel ──────────────────────────────────────────────────

interface CheckinPanelProps {
  member: User;
  quarter: QuarterKey;
  cycleId: string;
  onClose: () => void;
}

function CheckinPanel({ member, quarter, cycleId, onClose }: Readonly<CheckinPanelProps>) {
  const { data: detail, isLoading } = useEmployeeCheckinDetail(member.id, quarter, cycleId);
  const createCheckin = useCreateCheckin(quarter, cycleId);
  const updateCheckin = useUpdateCheckin(member.id, quarter, cycleId);

  const existing = detail?.existingCheckin ?? null;

  const [comment, setComment] = useState(existing?.comment ?? "");
  const [sentiment, setSentiment] = useState<CheckinRatingSentiment | null>(
    existing?.overallRatingSentiment ?? null
  );
  const [goalIds, setGoalIds] = useState<string[]>(existing?.goalsDiscussed ?? []);
  const [editReason, setEditReason] = useState("");

  const toggleGoal = (id: string) =>
    setGoalIds((prev) =>
      prev.includes(id) ? prev.filter((g) => g !== id) : [...prev, id]
    );

  const isPending = createCheckin.isPending || updateCheckin.isPending;

  const handleSubmit = async () => {
    const trimmed = comment.trim();
    if (trimmed.length < 20) return;

    if (existing) {
      if (editReason.trim().length < 10) return;
      await updateCheckin.mutateAsync({
        checkinId: existing.id,
        comment: trimmed,
        overallRatingSentiment: sentiment,
        goalsDiscussed: goalIds.length > 0 ? goalIds : undefined,
        editReason: editReason.trim(),
      });
    } else {
      await createCheckin.mutateAsync({
        employeeId: member.id,
        cycleId,
        quarter,
        comment: trimmed,
        commentType: CheckinCommentType.FREEFORM,
        overallRatingSentiment: sentiment,
        goalsDiscussed: goalIds.length > 0 ? goalIds : undefined,
      });
    }
    onClose();
  };

  return (
    <div className="mt-md border-t border-outline-variant pt-md space-y-md">
      {isLoading ? (
        <div className="space-y-sm">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-surface-container-high rounded animate-pulse" />
          ))}
        </div>
      ) : (
        <>
          {/* Goals + achievements table */}
          {detail && detail.goals.length > 0 && (
            <div>
              <h4 className="text-label-lg text-on-surface-variant mb-sm">Goals &amp; Actuals</h4>
              <div className="rounded-lg border border-outline-variant overflow-hidden">
                <table className="w-full text-body-sm">
                  <thead>
                    <tr className="bg-surface-container-low border-b border-outline-variant">
                      <th className="text-left text-label-md text-on-surface-variant px-md py-sm font-medium">Goal</th>
                      <th className="text-left text-label-md text-on-surface-variant px-md py-sm font-medium hidden sm:table-cell">Type</th>
                      <th className="text-right text-label-md text-on-surface-variant px-md py-sm font-medium">Target</th>
                      <th className="text-right text-label-md text-on-surface-variant px-md py-sm font-medium">Actual</th>
                      <th className="text-right text-label-md text-on-surface-variant px-md py-sm font-medium hidden sm:table-cell">Score</th>
                      <th className="text-center text-label-md text-on-surface-variant px-md py-sm font-medium">Discuss</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.goals.map((g) => (
                      <GoalTableRow
                        key={g.id}
                        g={g}
                        isSelected={goalIds.includes(g.id)}
                        onToggle={toggleGoal}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Sentiment */}
          <div>
            <p className="text-label-md text-on-surface-variant block mb-xs">
              Overall Rating
            </p>
            <div className="flex flex-wrap gap-sm">
              {SENTIMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    setSentiment((prev) =>
                      prev === opt.value ? null : opt.value
                    )
                  }
                  className={`inline-flex items-center gap-xs px-md py-sm rounded-lg border text-label-md transition-colors ${
                    sentiment === opt.value
                      ? `${SENTIMENT_CHIP[opt.value]} border-transparent`
                      : "border-outline-variant text-on-surface-variant bg-surface-container-lowest hover:bg-surface-container-low"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]">{opt.icon}</span>
                  <span>{opt.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label htmlFor="checkin-comment" className="text-label-md text-on-surface-variant block mb-xs">
              Check-in Comment <span className="text-error">*</span>
              <span className="ml-sm text-label-sm">(min 20 characters)</span>
            </label>
            <textarea
              id="checkin-comment"
              rows={4}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Write your check-in feedback, observations, and next steps…"
              className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-sm py-2 resize-none"
            />
            <p className={`text-label-sm mt-xs text-right ${comment.trim().length < 20 ? "text-error" : "text-tertiary"}`}>
              {comment.trim().length} / 20 min
            </p>
          </div>

          {/* Edit reason — only when updating */}
          {existing && (
            <div>
              <label htmlFor="checkin-edit-reason" className="text-label-md text-on-surface-variant block mb-xs">
                Reason for edit <span className="text-error">*</span>
                <span className="ml-sm text-label-sm">(min 10 characters)</span>
              </label>
              <input
                id="checkin-edit-reason"
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Why are you updating this check-in?"
                className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-sm py-2"
              />
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-sm">
            <button
              type="button"
              onClick={onClose}
              className="px-md py-sm text-label-lg text-on-surface-variant hover:bg-surface-container-low rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={
                isPending ||
                comment.trim().length < 20 ||
                (Boolean(existing) && editReason.trim().length < 10)
              }
              className="inline-flex items-center gap-xs px-md py-sm bg-primary text-on-primary text-label-lg rounded-lg hover:opacity-90 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isPending ? (
                <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
              ) : (
                <span className="material-symbols-outlined text-[18px]">send</span>
              )}
              {existing ? "Update Check-in" : "Submit Check-in"}
            </button>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Employee status card ─────────────────────────────────────────────────────

interface MemberCardProps {
  member: User;
  quarter: QuarterKey;
  cycleId: string;
  teamStatus: Record<string, { achievementSubmitted: boolean; checkinDone: boolean; weightedScore: number | null; goalsTotal: number; goalsSubmitted: number }>;
}

function MemberCard({ member, quarter, cycleId, teamStatus }: Readonly<MemberCardProps>) {
  const [open, setOpen] = useState(false);
  const status = teamStatus[member.id];

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1 overflow-hidden">
      {/* Card header */}
      <div className="p-md flex items-center gap-md">
        {/* Avatar */}
        <div className="h-10 w-10 rounded-full bg-secondary-container text-on-secondary-container text-label-lg font-bold flex items-center justify-center shrink-0">
          {member.avatarInitials}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-title-sm text-on-surface font-medium truncate">{member.fullName}</p>
          <p className="text-label-md text-on-surface-variant truncate">{member.departmentName || member.employeeCode}</p>
        </div>

        {/* Status pills */}
        <div className="hidden sm:flex flex-col gap-xs shrink-0">
          <StatusPill done={Boolean(status?.achievementSubmitted)} label="Actuals submitted" />
          <StatusPill done={Boolean(status?.checkinDone)} label="Check-in done" />
        </div>

        {/* Score + CTA */}
        <div className="flex flex-col items-end gap-xs shrink-0 ml-sm">
          {status?.weightedScore !== null && status?.weightedScore !== undefined ? (
            <span className="text-headline-sm text-on-surface font-semibold">
              {Math.round(status.weightedScore)}%
            </span>
          ) : (
            <span className="text-label-md text-on-surface-variant">No score</span>
          )}
          <button
            type="button"
            onClick={() => setOpen((p) => !p)}
            className="inline-flex items-center gap-xs px-md py-xs bg-primary text-on-primary text-label-md rounded-lg hover:opacity-90 transition-all"
          >
            <span className="material-symbols-outlined text-[16px]">
              {status?.checkinDone ? "edit" : "rate_review"}
            </span>
            {status?.checkinDone ? "Edit" : "Check-in"}
          </button>
        </div>
      </div>

      {/* Goals progress bar */}
      {status && status.goalsTotal > 0 && (
        <div className="px-md pb-md">
          <div className="flex justify-between text-label-sm text-on-surface-variant mb-xs">
            <span>Actuals progress</span>
            <span>{status.goalsSubmitted} / {status.goalsTotal} goals</span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-1.5">
            <div
              className="bg-primary h-1.5 rounded-full transition-all"
              style={{ width: `${Math.round((status.goalsSubmitted / status.goalsTotal) * 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Inline check-in panel */}
      {open && (
        <CheckinPanel
          member={member}
          quarter={quarter}
          cycleId={cycleId}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  );
}

// ─── CheckinModule ────────────────────────────────────────────────────────────

export default function CheckinModule() {
  const { activeWindow } = useCycleStore();
  const cycleId = activeWindow?.id ?? "";
  const { data: directReports = [], isLoading: reportsLoading } = useDirectReports();

  const [quarter, setQuarter] = useState<QuarterKey>("q1");

  const { data: teamStatus = [], isLoading: statusLoading } = useTeamCheckinStatus(
    quarter,
    cycleId
  );

  const isLoading = reportsLoading || statusLoading;

  // Index team status by employeeId for O(1) lookup
  const statusByEmployee = Object.fromEntries(
    teamStatus.map((s) => [
      s.employeeId,
      {
        achievementSubmitted: s.achievementSubmitted,
        checkinDone: s.checkinDone,
        weightedScore: s.weightedScore,
        goalsTotal: s.goalsTotal,
        goalsSubmitted: s.goalsSubmitted,
      },
    ])
  );

  const doneCount = teamStatus.filter((s) => s.checkinDone).length;
  const submittedCount = teamStatus.filter((s) => s.achievementSubmitted).length;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full space-y-lg">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg text-on-surface">Check-in Module</h1>
          <p className="text-body-md text-on-surface-variant mt-xs">
            Review your team's actuals and record quarterly check-in notes.
          </p>
        </div>

        {/* Quarter tabs */}
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

      {/* Summary stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
        <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-secondary-container" />
          <div className="pl-xs">
            <p className="text-label-lg text-on-surface-variant">Team Members</p>
            <p className="text-headline-md text-on-surface">{directReports.length}</p>
          </div>
          <span className="material-symbols-outlined text-on-secondary-container/70 text-[28px]">group</span>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-primary/30" />
          <div className="pl-xs">
            <p className="text-label-lg text-on-surface-variant">Actuals Submitted</p>
            <p className="text-headline-md text-on-surface">{isLoading ? "—" : `${submittedCount} / ${directReports.length}`}</p>
          </div>
          <span className="material-symbols-outlined text-primary/70 text-[28px]">assignment_turned_in</span>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1 flex items-center justify-between gap-md relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-tertiary-container" />
          <div className="pl-xs">
            <p className="text-label-lg text-on-surface-variant">Check-ins Done</p>
            <p className="text-headline-md text-on-surface">{isLoading ? "—" : `${doneCount} / ${directReports.length}`}</p>
          </div>
          <span className="material-symbols-outlined text-on-tertiary-container/70 text-[28px]">rate_review</span>
        </div>
      </div>

      {/* Employee cards */}
      <div className="space-y-md">
        <h2 className="text-title-lg text-on-surface">Team Members</h2>

        {isLoading && (
          <div className="space-y-md">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant h-20 animate-pulse" />
            ))}
          </div>
        )}
        {!isLoading && directReports.length === 0 && (
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl text-center">
            <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">group</span>
            <p className="text-body-md text-on-surface-variant mt-md">No direct reports found.</p>
          </div>
        )}
        {!isLoading && directReports.length > 0 && directReports.map((member) => (
          <MemberCard
            key={member.id}
            member={member}
            quarter={quarter}
            cycleId={cycleId}
            teamStatus={statusByEmployee}
          />
        ))}
      </div>
    </div>
  );
}

