import { AlertTriangle, AlertCircle, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Variant = "default" | "destructive" | "warning";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel?: () => void;
  isLoading?: boolean;
  variant?: Variant;
}

// ─── Header icon per variant ──────────────────────────────────────────────────

function VariantIcon({ variant }: Readonly<{ variant: Variant }>) {
  if (variant === "destructive") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-100 shrink-0">
        <AlertCircle className="h-5 w-5 text-red-600" />
      </div>
    );
  }
  if (variant === "warning") {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-amber-100 shrink-0">
        <AlertTriangle className="h-5 w-5 text-amber-600" />
      </div>
    );
  }
  return null;
}

// ─── Confirm button variant map ───────────────────────────────────────────────

function confirmButtonVariant(
  variant: Variant
): "destructive" | "default" | "outline" {
  if (variant === "destructive") return "destructive";
  return "default";
}

function confirmButtonClass(variant: Variant): string {
  if (variant === "warning") return "bg-amber-500 hover:bg-amber-600 text-white";
  return "";
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  isLoading = false,
  variant = "default",
}: Readonly<Props>) {
  const handleCancel = () => {
    onCancel?.();
    onOpenChange(false);
  };

  const showIcon = variant !== "default";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={cn("flex items-start gap-3", showIcon && "flex-row")}>
            {showIcon && <VariantIcon variant={variant} />}
            <div className="flex flex-col gap-1">
              <DialogTitle className="text-base">{title}</DialogTitle>
              {description && (
                <DialogDescription className="text-sm">
                  {description}
                </DialogDescription>
              )}
            </div>
          </div>
        </DialogHeader>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="outline"
            onClick={handleCancel}
            disabled={isLoading}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={confirmButtonVariant(variant)}
            className={confirmButtonClass(variant)}
            onClick={onConfirm}
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
