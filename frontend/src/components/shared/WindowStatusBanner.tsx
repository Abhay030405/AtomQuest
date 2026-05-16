import { useState } from "react";
import { AlertTriangle, CheckCircle2, XCircle, Info, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/utils/date.util";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type BannerVariant = "success" | "warning" | "error" | "info";

interface Props {
  readonly isOpen: boolean;
  readonly daysRemaining: number;
  readonly closeDate: string;
  readonly openDate: string;
  readonly variant: BannerVariant;
}

// ─── Variant config ───────────────────────────────────────────────────────────

const VARIANT_CONFIG = {
  success: {
    icon: CheckCircle2,
    wrapper: "bg-emerald-50 border-emerald-200 text-emerald-800",
    icon_class: "text-emerald-600",
    button: "text-emerald-600 hover:bg-emerald-100",
  },
  warning: {
    icon: AlertTriangle,
    wrapper: "bg-amber-50 border-amber-200 text-amber-800",
    icon_class: "text-amber-600",
    button: "text-amber-600 hover:bg-amber-100",
  },
  error: {
    icon: XCircle,
    wrapper: "bg-red-50 border-red-200 text-red-800",
    icon_class: "text-red-600",
    button: "text-red-600 hover:bg-red-100",
  },
  info: {
    icon: Info,
    wrapper: "bg-blue-50 border-blue-200 text-blue-800",
    icon_class: "text-blue-600",
    button: "text-blue-600 hover:bg-blue-100",
  },
};

// ─── Banner text per state ────────────────────────────────────────────────────

function getBannerText(
  isOpen: boolean,
  daysRemaining: number,
  closeDate: string,
  openDate: string
): string {
  if (isOpen && daysRemaining > 7) {
    return `Goal Setting Window: Open until ${formatDate(closeDate)} · ${daysRemaining} days remaining`;
  }
  if (isOpen && daysRemaining > 0) {
    return `⚠ Goal Setting Window closes in ${daysRemaining} day${daysRemaining === 1 ? "" : "s"} — submit before ${formatDate(closeDate)}`;
  }
  if (!isOpen && daysRemaining === 0) {
    return `Goal Setting Window is closed · Next window opens in July for Q1 Check-in`;
  }
  // Not yet open
  return `Q1 Check-in Window opens ${formatDate(openDate)}`;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function WindowStatusBanner({
  isOpen,
  daysRemaining,
  closeDate,
  openDate,
  variant,
}: Readonly<Props>) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;
  const text = getBannerText(isOpen, daysRemaining, closeDate, openDate);

  return (
    <div
      className={cn(
        "sticky top-0 z-20 flex items-center gap-3 border-b px-4 py-2.5 md:px-6",
        config.wrapper
      )}
      role="status"
      aria-live="polite"
    >
      <Icon className={cn("h-4 w-4 shrink-0", config.icon_class)} />
      <p className="flex-1 text-sm font-medium">{text}</p>
      <Button
        variant="ghost"
        size="icon"
        className={cn("h-6 w-6 shrink-0", config.button)}
        onClick={() => setDismissed(true)}
        aria-label="Dismiss banner"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
