import {
  FileEdit,
  Send,
  Eye,
  CheckCircle,
  Lock,
  Archive,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { GOAL_STATUS_META } from "@/constants/goalStatus";
import { GoalStatus } from "@/types/goal.types";
import type { GoalStatus as GoalStatusType } from "@/types/goal.types";
import { cn } from "@/lib/utils";

const STATUS_ICONS: Record<GoalStatusType, LucideIcon> = {
  [GoalStatus.DRAFT]: FileEdit,
  [GoalStatus.SUBMITTED]: Send,
  [GoalStatus.UNDER_REVIEW]: Eye,
  [GoalStatus.APPROVED]: CheckCircle,
  [GoalStatus.LOCKED]: Lock,
  [GoalStatus.ARCHIVED]: Archive,
};

interface Props {
  status: GoalStatusType;
  size?: "default" | "sm";
}

export function GoalStatusBadge({ status, size = "default" }: Readonly<Props>) {
  const meta = GOAL_STATUS_META[status];
  const Icon = STATUS_ICONS[status];

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            className={cn(
              "border font-medium inline-flex items-center gap-1 cursor-default select-none",
              meta.colorClass,
              size === "sm"
                ? "text-[10px] px-1.5 py-0 h-4"
                : "text-xs px-2 py-0.5"
            )}
          >
            <Icon
              className={cn(
                "shrink-0",
                size === "sm" ? "h-2.5 w-2.5" : "h-3 w-3"
              )}
            />
            {meta.label}
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[200px] text-center">
          <p className="text-xs">{meta.description}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
