import { useState } from "react";
import { useCycleStore } from "@/store/cycleStore";
import { useMyCheckins, useAcknowledgeCheckin } from "@/hooks/useCheckins";
import {
  CheckinRatingSentiment,
  SENTIMENT_LABEL,
  SENTIMENT_CHIP,
} from "@/services/checkin.service";

// ─── Quarter tabs ─────────────────────────────────────────────────────────────

const QUARTERS = [
  { id: "q1", label: "Q1" },
  { id: "q2", label: "Q2" },
  { id: "q3", label: "Q3" },
  { id: "q4", label: "Q4" },
] as const;
type QuarterKey = (typeof QUARTERS)[number]["id"];

// ─── Sentiment badge ──────────────────────────────────────────────────────────

function SentimentBadge({ value }: Readonly<{ value: CheckinRatingSentiment | null }>) {
  if (!value) return null;
  return (
    <span className={`inline-flex items-center gap-xs px-2 py-0.5 rounded text-label-sm ${SENTIMENT_CHIP[value]}`}>
      <span className="material-symbols-outlined text-[13px]">
        {value === CheckinRatingSentiment.POSITIVE
          ? "sentiment_satisfied"
          : value === CheckinRatingSentiment.NEUTRAL
          ? "sentiment_neutral"
          : "sentiment_dissatisfied"}
      </span>
      {SENTIMENT_LABEL[value]}
    </span>
  );
}

// ─── Single check-in card ─────────────────────────────────────────────────────

interface CheckinCardProps {
  checkin: import("@/services/checkin.service").CheckinRecord;
  onAcknowledge: (id: string) => void;
  isPending: boolean;
}

function CheckinCard({ checkin, onAcknowledge, isPending }: Readonly<CheckinCardProps>) {
  const [expanded, setExpanded] = useState(false);

  const completedDate = checkin.completedAt
    ? new Date(checkin.completedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  const acknowledgedDate = checkin.acknowledgedAt
    ? new Date(checkin.acknowledgedAt).toLocaleDateString("en-IN", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;

  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1">
      {/* Card header */}
      <div className="flex items-start gap-md p-md">
        <div className="w-10 h-10 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center shrink-0">
          <span className="material-symbols-outlined text-[20px]">person</span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-sm">
            <p className="text-title-md text-on-surface font-semibold">
              {checkin.managerName ?? "Your Manager"}
            </p>
            {completedDate && (
              <span className="text-label-sm text-on-surface-variant">{completedDate}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-sm mt-xs">
            <SentimentBadge value={checkin.overallRatingSentiment} />
            {checkin.isAcknowledgedByEmployee ? (
              <span className="inline-flex items-center gap-xs px-2 py-0.5 rounded text-label-sm bg-tertiary-container text-on-tertiary-container">
                <span className="material-symbols-outlined text-[13px]">check_circle</span>
                Acknowledged{acknowledgedDate ? ` · ${acknowledgedDate}` : ""}
              </span>
            ) : (
              <span className="inline-flex items-center gap-xs px-2 py-0.5 rounded text-label-sm bg-surface-variant text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px]">radio_button_unchecked</span>
                Pending acknowledgement
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setExpanded((p) => !p)}
          aria-label={expanded ? "Collapse" : "Expand"}
          className="shrink-0 w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container-low text-on-surface-variant transition-colors"
        >
          <span className="material-symbols-outlined text-[20px]">
            {expanded ? "expand_less" : "expand_more"}
          </span>
        </button>
      </div>

      {/* Expanded content */}
      {expanded && (
        <div className="border-t border-outline-variant px-md pb-md space-y-md pt-md">
          {/* Comment */}
          <div>
            <p className="text-label-md text-on-surface-variant mb-xs">Manager Feedback</p>
            <p className="text-body-md text-on-surface whitespace-pre-wrap leading-relaxed">
              {checkin.comment}
            </p>
          </div>

          {/* Goals discussed */}
          {checkin.goalsDiscussed && checkin.goalsDiscussed.length > 0 && (
            <div>
              <p className="text-label-md text-on-surface-variant mb-xs">
                Goals Discussed ({checkin.goalsDiscussed.length})
              </p>
              <p className="text-body-sm text-on-surface-variant">
                {checkin.goalsDiscussed.length} goal(s) were marked as discussed in this check-in.
              </p>
            </div>
          )}

          {/* Acknowledge action */}
          {!checkin.isAcknowledgedByEmployee && (
            <div className="flex justify-end pt-xs border-t border-outline-variant">
              <button
                type="button"
                disabled={isPending}
                onClick={() => onAcknowledge(checkin.id)}
                className="inline-flex items-center gap-xs px-md py-sm rounded-lg bg-primary text-on-primary text-label-lg font-medium disabled:opacity-50 transition-opacity"
              >
                <span className="material-symbols-outlined text-[18px]">
                  {isPending ? "hourglass_empty" : "done_all"}
                </span>
                Acknowledge
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── CheckinsReceived ─────────────────────────────────────────────────────────

export default function CheckinsReceived() {
  const { activeWindow } = useCycleStore();
  const cycleId = activeWindow?.id ?? "";

  const [quarter, setQuarter] = useState<QuarterKey>("q1");

  const { data: checkins = [], isLoading } = useMyCheckins(quarter, cycleId);
  const acknowledge = useAcknowledgeCheckin(quarter, cycleId);

  const pendingCount = checkins.filter((c) => !c.isAcknowledgedByEmployee).length;

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div>
        <h1 className="text-headline-md text-on-surface">My Check-ins</h1>
        <p className="text-body-md text-on-surface-variant mt-xs">
          Review feedback from your manager and acknowledge it.
        </p>
      </div>

      {/* Quarter tabs */}
      <div className="flex gap-xs overflow-x-auto pb-xs">
        {QUARTERS.map((q) => (
          <button
            key={q.id}
            type="button"
            onClick={() => setQuarter(q.id)}
            className={`px-md py-sm rounded-lg text-label-lg font-medium shrink-0 transition-colors ${
              quarter === q.id
                ? "bg-primary text-on-primary"
                : "bg-surface-container-low text-on-surface-variant hover:bg-surface-container"
            }`}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Summary bar */}
      {checkins.length > 0 && (
        <div className="bg-surface-container-low rounded-xl border border-outline-variant px-md py-sm flex flex-wrap gap-md items-center">
          <div className="flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px] text-on-surface-variant">rate_review</span>
            <span className="text-body-md text-on-surface">
              <strong>{checkins.length}</strong> check-in{checkins.length !== 1 ? "s" : ""}
            </span>
          </div>
          {pendingCount > 0 && (
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px] text-error">pending_actions</span>
              <span className="text-body-md text-error">
                <strong>{pendingCount}</strong> awaiting acknowledgement
              </span>
            </div>
          )}
          {pendingCount === 0 && (
            <div className="flex items-center gap-xs">
              <span className="material-symbols-outlined text-[18px] text-tertiary">task_alt</span>
              <span className="text-body-md text-tertiary">All acknowledged</span>
            </div>
          )}
        </div>
      )}

      {/* Content */}
      {isLoading && (
        <div className="space-y-md">
          {[1, 2].map((i) => (
            <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant h-24 animate-pulse" />
          ))}
        </div>
      )}

      {!isLoading && checkins.length === 0 && (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl text-center space-y-md">
          <span className="material-symbols-outlined text-[56px] text-on-surface-variant/40">rate_review</span>
          <div>
            <p className="text-title-md text-on-surface-variant">No check-ins yet for {quarter.toUpperCase()}</p>
            <p className="text-body-sm text-on-surface-variant/70 mt-xs">
              Your manager hasn&apos;t submitted a check-in for this quarter yet.
            </p>
          </div>
        </div>
      )}

      {!isLoading && checkins.length > 0 && (
        <div className="space-y-md">
          {checkins.map((c) => (
            <CheckinCard
              key={c.id}
              checkin={c}
              onAcknowledge={(id) => acknowledge.mutate(id)}
              isPending={acknowledge.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}
