import { CheckCircle2, FileEdit, Send, Eye, CheckCircle, Lock, Archive } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { GoalStatus } from "@/types/goal.types";
import type { GoalStatus as GoalStatusType, GoalEvent, GoalEventType } from "@/types/goal.types";
import { GOAL_STATUS_META } from "@/constants/goalStatus";
import { formatDate } from "@/utils/date.util";
import { cn } from "@/lib/utils";

const STATUS_ICONS: Record<GoalStatusType, LucideIcon> = {
  [GoalStatus.DRAFT]: FileEdit,
  [GoalStatus.SUBMITTED]: Send,
  [GoalStatus.UNDER_REVIEW]: Eye,
  [GoalStatus.APPROVED]: CheckCircle,
  [GoalStatus.LOCKED]: Lock,
  [GoalStatus.ARCHIVED]: Archive,
};

// Maps each status to the event type that transitions into it
const STATUS_EVENT_MAP: Partial<Record<GoalStatusType, GoalEventType>> = {
  [GoalStatus.DRAFT]: "CREATED",
  [GoalStatus.SUBMITTED]: "SUBMITTED",
  [GoalStatus.APPROVED]: "APPROVED",
  [GoalStatus.LOCKED]: "LOCKED",
  [GoalStatus.ARCHIVED]: "ARCHIVED",
};

const STATUS_FLOW: GoalStatusType[] = [
  GoalStatus.DRAFT,
  GoalStatus.SUBMITTED,
  GoalStatus.UNDER_REVIEW,
  GoalStatus.APPROVED,
  GoalStatus.LOCKED,
];

type NodeState = "completed" | "current" | "future";

interface TimelineNode {
  status: GoalStatusType;
  actorName?: string;
  date?: string;
  state: NodeState;
}

interface Props {
  currentStatus: GoalStatusType;
  events?: GoalEvent[];
}

export function GoalTimeline({ currentStatus, events = [] }: Readonly<Props>) {
  const statuses: GoalStatusType[] =
    currentStatus === GoalStatus.ARCHIVED
      ? [...STATUS_FLOW, GoalStatus.ARCHIVED]
      : STATUS_FLOW;

  const currentIndex = statuses.indexOf(currentStatus);

  const nodes: TimelineNode[] = statuses.map((status, i) => {
    const targetEvent = STATUS_EVENT_MAP[status];
    const matchingEvent = targetEvent
      ? events.find((e) => e.eventType === targetEvent)
      : undefined;

    let state: NodeState;
    if (i < currentIndex) state = "completed";
    else if (i === currentIndex) state = "current";
    else state = "future";

    return {
      status,
      actorName: matchingEvent?.actorName,
      date: matchingEvent?.occurredAt,
      state,
    };
  });

  return (
    <div className="flex items-start gap-0 overflow-x-auto pb-2">
      {nodes.map((node, i) => {
        const Icon = STATUS_ICONS[node.status];
        const meta = GOAL_STATUS_META[node.status];
        const isLast = i === nodes.length - 1;

        return (
          <div key={node.status} className="flex items-start">
            {/* Node column */}
            <div className="flex flex-col items-center gap-1.5 min-w-[80px] max-w-[80px]">
              {/* Circle */}
              <div
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all shrink-0",
                  node.state === "completed" &&
                    "border-emerald-500 bg-emerald-500 text-white",
                  node.state === "current" &&
                    "border-indigo-600 bg-indigo-600 text-white ring-2 ring-indigo-200 animate-pulse",
                  node.state === "future" &&
                    "border-muted bg-background text-muted-foreground/30"
                )}
              >
                {node.state === "completed" ? (
                  <CheckCircle2 className="h-4 w-4" />
                ) : (
                  <Icon className="h-3.5 w-3.5" />
                )}
              </div>

              {/* Status label */}
              <span
                className={cn(
                  "text-[10px] font-medium text-center leading-tight px-0.5",
                  node.state === "completed" && "text-emerald-600",
                  node.state === "current" && "text-indigo-700 font-semibold",
                  node.state === "future" && "text-muted-foreground/50"
                )}
              >
                {meta.label}
              </span>

              {/* Actor name */}
              {node.actorName && (
                <span className="text-[9px] text-muted-foreground text-center leading-tight">
                  {node.actorName}
                </span>
              )}

              {/* Date */}
              {node.date && (
                <span className="text-[9px] text-muted-foreground/70 text-center leading-tight">
                  {formatDate(node.date, "dd MMM")}
                </span>
              )}
            </div>

            {/* Connector line — sits vertically centred with the circles */}
            {!isLast && (
              <div className="flex items-center pt-4 shrink-0">
                <div
                  className={cn(
                    "h-0.5 w-6",
                    i < currentIndex ? "bg-emerald-400" : "bg-muted"
                  )}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
