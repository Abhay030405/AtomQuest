import { useState } from "react";
import {
  Pencil,
  Trash2,
  Clock,
  Lock,
  Link2,
  TrendingUp,
  TrendingDown,
  Calendar,
  ShieldCheck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GoalStatusBadge } from "./GoalStatusBadge";
import { GoalVersionDrawer } from "./GoalVersionDrawer";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { formatDate } from "@/utils/date.util";
import { GoalStatus, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { cn } from "@/lib/utils";

// ─── Status → left border colour ──────────────────────────────────────────────

const STATUS_BORDER: Record<string, string> = {
  [GoalStatus.DRAFT]: "border-l-gray-400",
  [GoalStatus.SUBMITTED]: "border-l-blue-400",
  [GoalStatus.UNDER_REVIEW]: "border-l-amber-400",
  [GoalStatus.APPROVED]: "border-l-emerald-500",
  [GoalStatus.LOCKED]: "border-l-purple-500",
  [GoalStatus.ARCHIVED]: "border-l-slate-400",
};

const UOM_ICONS: Record<string, LucideIcon> = {
  [UoMType.MIN]: TrendingUp,
  [UoMType.MAX]: TrendingDown,
  [UoMType.TIMELINE]: Calendar,
  [UoMType.ZERO]: ShieldCheck,
};

// ─── Sub-components ────────────────────────────────────────────────────────────

interface UomBadgeProps {
  readonly uomType: string;
}

function UomBadge({ uomType }: UomBadgeProps) {
  const meta = UOM_TYPE_META[uomType as keyof typeof UOM_TYPE_META];
  const Icon = UOM_ICONS[uomType];
  if (!meta || !Icon) return null;
  return (
    <Badge variant="outline" className="text-[10px] gap-1 py-0 h-5 px-1.5 font-normal">
      <Icon className="h-2.5 w-2.5 shrink-0" />
      {meta.label}
    </Badge>
  );
}

interface TargetDisplayProps {
  readonly goal: Goal;
}

function TargetDisplay({ goal }: TargetDisplayProps) {
  if (goal.uomType === UoMType.TIMELINE) {
    const date = goal.targetDate
      ? formatDate(goal.targetDate, "dd MMM yyyy")
      : "—";
    return (
      <>
        Deadline:{" "}
        <span className="font-medium text-foreground">{date}</span>
      </>
    );
  }
  if (goal.uomType === UoMType.ZERO) {
    return (
      <>
        Target:{" "}
        <span className="font-medium text-foreground">Zero Incidents</span>
      </>
    );
  }
  const direction =
    goal.uomType === UoMType.MIN ? "Higher is better" : "Lower is better";
  return (
    <>
      Target:{" "}
      <span className="font-medium text-foreground">{goal.targetValue}</span>
      <span className="text-muted-foreground/60 ml-1">({direction})</span>
    </>
  );
}

// ─── GoalCard ─────────────────────────────────────────────────────────────────

interface Props {
  goal: Goal;
  isReadOnly?: boolean;
  isWindowOpen?: boolean;
  onEdit?: (goal: Goal) => void;
  onDelete?: (goalId: string) => void;
  onViewHistory?: (goal: Goal) => void;
}

export function GoalCard({
  goal,
  isReadOnly = false,
  isWindowOpen = true,
  onEdit,
  onDelete,
  onViewHistory,
}: Readonly<Props>) {
  const [descExpanded, setDescExpanded] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

  const isLockedOrApproved =
    goal.status === GoalStatus.LOCKED || goal.status === GoalStatus.APPROVED;
  const isDraft = goal.status === GoalStatus.DRAFT;
  const canEdit = isDraft && !isReadOnly && isWindowOpen;

  const borderClass = STATUS_BORDER[goal.status] ?? "border-l-gray-200";

  const handleViewHistory = () => {
    if (onViewHistory) {
      onViewHistory(goal);
    } else {
      setHistoryOpen(true);
    }
  };

  return (
    <>
      <Card className={cn("border-l-4 transition-shadow hover:shadow-sm", borderClass)}>
        {/* ── Header row ──────────────────────────────────────── */}
        <div className="px-4 pt-4 pb-2">
          {/* Badge row */}
          <div className="flex flex-wrap items-center gap-1.5 mb-2">
            <Badge
              variant="secondary"
              className="text-[10px] h-4 px-1.5 py-0 bg-muted/60 text-muted-foreground font-normal"
            >
              {formatThrustArea(goal.thrustArea)}
            </Badge>
            <UomBadge uomType={goal.uomType} />
            <span className="text-[10px] font-semibold bg-indigo-50 text-indigo-600 border border-indigo-200 px-1.5 py-0 rounded">
              {goal.weightage}%
            </span>
            {goal.isShared && (
              <Badge className="text-[10px] h-4 px-1.5 py-0 bg-amber-50 text-amber-700 border border-amber-200 gap-1">
                <Link2 className="h-2.5 w-2.5" />
                Shared KPI
              </Badge>
            )}
          </div>

          {/* Title + lock indicator */}
          <div className="flex items-start justify-between gap-2">
            <h3 className="text-sm font-semibold leading-snug text-foreground">
              {goal.title}
            </h3>
            {isLockedOrApproved && (
              <div className="flex items-center gap-1 text-muted-foreground/50 shrink-0 mt-0.5">
                <Lock className="h-3 w-3" />
                <span className="text-[10px]">Locked</span>
              </div>
            )}
          </div>
        </div>

        <CardContent className="px-4 pb-4 space-y-2.5">
          {/* Target value */}
          <p className="text-xs text-muted-foreground">
            <TargetDisplay goal={goal} />
          </p>

          {/* Description with expand */}
          {goal.description && (
            <div className="text-xs text-muted-foreground leading-relaxed">
              <p className={cn(!descExpanded && "line-clamp-2")}>{goal.description}</p>
              {goal.description.length > 100 && (
                <button
                  className="text-indigo-600 hover:underline mt-0.5 text-[11px] font-medium"
                  onClick={() => setDescExpanded((e) => !e)}
                >
                  {descExpanded ? "Show less" : "Read more"}
                </button>
              )}
            </div>
          )}

          {/* Shared KPI hint */}
          {goal.isShared && canEdit && (
            <p className="text-[11px] text-amber-600 italic">
              Shared KPI — only weightage can be edited.
            </p>
          )}

          {/* ── Footer row ──────────────────────────────────────── */}
          <div className="flex items-center justify-between pt-1 border-t border-muted/50">
            <div className="flex items-center gap-2">
              <GoalStatusBadge status={goal.status} size="sm" />
              <span className="text-[10px] text-muted-foreground">
                Added {formatDate(goal.createdAt, "dd MMM yyyy")}
              </span>
            </div>

            <div className="flex items-center gap-1">
              {canEdit ? (
                <>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-foreground"
                    title="Edit goal"
                    onClick={() => onEdit?.(goal)}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-red-400 hover:text-red-600 hover:bg-red-50"
                    title="Delete goal"
                    onClick={() => onDelete?.(goal.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </>
              ) : (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-foreground"
                  title="View version history"
                  onClick={handleViewHistory}
                >
                  <Clock className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <GoalVersionDrawer
        open={historyOpen}
        onClose={() => setHistoryOpen(false)}
        goalId={goal.id}
        goalTitle={goal.title}
      />
    </>
  );
}
