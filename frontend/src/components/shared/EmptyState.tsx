import { Target, Inbox, Users, Clock, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant =
  | "no-goals"
  | "no-approvals"
  | "no-team-goals"
  | "window-closed"
  | "no-audit-logs";

interface ActionConfig {
  label: string;
  onClick: () => void;
}

interface Props {
  icon?: LucideIcon;
  title?: string;
  description?: string;
  action?: ActionConfig;
  variant?: Variant;
  className?: string;
}

// ─── Variant defaults ─────────────────────────────────────────────────────────

interface VariantConfig {
  icon: LucideIcon;
  title: string;
  description: string;
}

const VARIANTS: Record<Variant, VariantConfig> = {
  "no-goals": {
    icon: Target,
    title: "No goals yet",
    description: "Start building your goal sheet for FY2026",
  },
  "no-approvals": {
    icon: Inbox,
    title: "All caught up!",
    description: "No goal sheets are waiting for your approval",
  },
  "no-team-goals": {
    icon: Users,
    title: "No team goals found",
    description: "Your team members haven't added any goals yet",
  },
  "window-closed": {
    icon: Clock,
    title: "Window is closed",
    description:
      "The goal-setting window is currently closed. Check back when the next cycle opens.",
  },
  "no-audit-logs": {
    icon: Shield,
    title: "No audit records found",
    description: "No activity matches your current filter",
  },
};

// ─── Component ────────────────────────────────────────────────────────────────

export function EmptyState({
  icon,
  title,
  description,
  action,
  variant,
  className,
}: Readonly<Props>) {
  const defaults = variant ? VARIANTS[variant] : undefined;
  const Icon = icon ?? defaults?.icon ?? Inbox;
  const displayTitle = title ?? defaults?.title ?? "Nothing here yet";
  const displayDescription = description ?? defaults?.description;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-16 text-center px-6",
        className
      )}
    >
      {/* Icon circle */}
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4 shrink-0">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>

      {/* Text */}
      <h3 className="text-sm font-semibold text-foreground">{displayTitle}</h3>
      {displayDescription && (
        <p className="mt-1 text-xs text-muted-foreground max-w-xs leading-relaxed">
          {displayDescription}
        </p>
      )}

      {/* Optional CTA */}
      {action && (
        <Button size="sm" className="mt-4" onClick={action.onClick}>
          {action.label}
        </Button>
      )}
    </div>
  );
}
