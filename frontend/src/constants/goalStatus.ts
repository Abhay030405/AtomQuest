import { GoalStatus } from "@/types/goal.types";

export interface GoalStatusMeta {
  label: string;
  badgeVariant: "default" | "secondary" | "outline" | "destructive";
  /** Lucide icon name */
  icon: string;
  /** User-facing description of what this status means */
  description: string;
  /** Tailwind classes for coloured badge */
  colorClass: string;
}

export const GOAL_STATUS_META: Record<GoalStatus, GoalStatusMeta> = {
  [GoalStatus.DRAFT]: {
    label: "Draft",
    badgeVariant: "secondary",
    icon: "FileEdit",
    description: "Goal is being drafted and has not been submitted yet.",
    colorClass: "bg-status-draft-light text-status-draft-foreground border-status-draft",
  },
  [GoalStatus.SUBMITTED]: {
    label: "Submitted",
    badgeVariant: "default",
    icon: "Send",
    description: "Goal sheet submitted and awaiting manager review.",
    colorClass: "bg-status-submitted-light text-status-submitted-foreground border-status-submitted",
  },
  [GoalStatus.UNDER_REVIEW]: {
    label: "Under Review",
    badgeVariant: "outline",
    icon: "Eye",
    description: "Manager is actively reviewing this goal.",
    colorClass: "bg-status-under-review-light text-status-under-review-foreground border-status-under-review",
  },
  [GoalStatus.APPROVED]: {
    label: "Approved",
    badgeVariant: "default",
    icon: "CheckCircle",
    description: "Goal approved by manager and ready for tracking.",
    colorClass: "bg-status-approved-light text-status-approved-foreground border-status-approved",
  },
  [GoalStatus.LOCKED]: {
    label: "Locked",
    badgeVariant: "outline",
    icon: "Lock",
    description: "Goal is locked for the current cycle and cannot be modified.",
    colorClass: "bg-status-locked-light text-status-locked-foreground border-status-locked",
  },
  [GoalStatus.ARCHIVED]: {
    label: "Archived",
    badgeVariant: "secondary",
    icon: "Archive",
    description: "Goal belongs to a past cycle and is archived.",
    colorClass: "bg-status-archived-light text-status-archived-foreground border-status-archived",
  },
};

// Convenience accessors kept for backwards compat
export const GOAL_STATUS_LABELS = Object.fromEntries(
  Object.entries(GOAL_STATUS_META).map(([k, v]) => [k, v.label])
) as Record<GoalStatus, string>;

export const GOAL_STATUS_COLORS = Object.fromEntries(
  Object.entries(GOAL_STATUS_META).map(([k, v]) => [k, v.colorClass])
) as Record<GoalStatus, string>;
