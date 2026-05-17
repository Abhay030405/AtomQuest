import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ThrustArea, UoMType } from "@/types/goal.types";
import type { Goal } from "@/types/goal.types";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";

const INPUT_CLS =
  "w-full border border-outline-variant rounded bg-surface-container-lowest text-body-md text-on-surface h-10 px-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all";
const LABEL_CLS =
  "block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs";

export interface GoalFormValues {
  title: string;
  description: string;
  thrustArea: ThrustArea;
  uomType: UoMType;
  targetValue: number | null;
  targetDate?: string;
  weightage: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  mode: "create" | "edit";
  initial?: Goal | null;
  onSubmit: (values: GoalFormValues) => Promise<void> | void;
  submitting?: boolean;
}

function blankForm(): {
  title: string;
  description: string;
  thrustArea: ThrustArea;
  uomType: UoMType;
  targetValue: string;
  targetDate: string;
  weightage: string;
} {
  return {
    title: "",
    description: "",
    thrustArea: ThrustArea.REVENUE_GROWTH,
    uomType: UoMType.MIN,
    targetValue: "",
    targetDate: "",
    weightage: "",
  };
}

export function GoalFormDialog({ open, onClose, mode, initial, onSubmit, submitting }: Readonly<Props>) {
  const [form, setForm] = useState(blankForm());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (mode === "edit" && initial) {
      setForm({
        title: initial.title,
        description: initial.description ?? "",
        thrustArea: initial.thrustArea,
        uomType: initial.uomType,
        targetValue: initial.targetValue != null ? String(initial.targetValue) : "",
        targetDate: initial.targetDate ?? "",
        weightage: String(initial.weightage ?? ""),
      });
    } else {
      setForm(blankForm());
    }
    setError(null);
  }, [open, mode, initial]);

  const isTimeline = form.uomType === UoMType.TIMELINE;
  const isZero = form.uomType === UoMType.ZERO;

  function patch(p: Partial<typeof form>) {
    setForm((f) => ({ ...f, ...p }));
  }

  async function handleSave() {
    setError(null);
    const title = form.title.trim();
    if (!title) {
      setError("Title is required");
      return;
    }
    const weightage = Number(form.weightage);
    if (!Number.isFinite(weightage) || weightage < 10 || weightage > 100) {
      setError("Weightage must be between 10 and 100");
      return;
    }
    let targetValue: number | null = null;
    let targetDate: string | undefined;
    if (isTimeline) {
      if (!form.targetDate) {
        setError("Target date is required for TIMELINE goals");
        return;
      }
      targetDate = form.targetDate;
    } else if (isZero) {
      targetValue = 0;
    } else {
      const n = Number(form.targetValue);
      if (!Number.isFinite(n)) {
        setError("Target value is required");
        return;
      }
      targetValue = n;
    }

    try {
      await onSubmit({
        title,
        description: form.description.trim(),
        thrustArea: form.thrustArea,
        uomType: form.uomType,
        targetValue,
        targetDate,
        weightage,
      });
      onClose();
    } catch (e: any) {
      setError(e?.message ?? "Failed to save goal");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-[640px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit Goal" : "New Goal"}</DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-12 gap-md py-2">
          <div className="col-span-12 md:col-span-4">
            <label className={LABEL_CLS}>Thrust Area</label>
            <select
              value={form.thrustArea}
              onChange={(e) => patch({ thrustArea: e.target.value as ThrustArea })}
              className={INPUT_CLS}
            >
              {Object.values(ThrustArea).map((ta) => (
                <option key={ta} value={ta}>
                  {formatThrustArea(ta)}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-8">
            <label className={LABEL_CLS}>Goal Title</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => patch({ title: e.target.value })}
              placeholder="e.g. Increase quarterly revenue by 15%"
              maxLength={200}
              className={INPUT_CLS}
            />
          </div>

          <div className="col-span-12">
            <label className={LABEL_CLS}>
              Description <span className="normal-case text-outline">(optional)</span>
            </label>
            <textarea
              value={form.description}
              onChange={(e) => patch({ description: e.target.value })}
              placeholder="Describe the goal, measurement criteria, and expected outcomes…"
              rows={2}
              maxLength={500}
              className="w-full border border-outline-variant rounded bg-surface-container-lowest text-body-md text-on-surface px-sm py-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all resize-none"
            />
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className={LABEL_CLS}>Unit of Measure</label>
            <select
              value={form.uomType}
              onChange={(e) =>
                patch({ uomType: e.target.value as UoMType, targetValue: "", targetDate: "" })
              }
              className={INPUT_CLS}
            >
              {Object.values(UoMType).map((u) => (
                <option key={u} value={u}>
                  {UOM_TYPE_META[u].label}
                </option>
              ))}
            </select>
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className={LABEL_CLS}>Target Value</label>
            {(() => {
              if (isTimeline) {
                return (
                  <input
                    type="date"
                    value={form.targetDate}
                    onChange={(e) => patch({ targetDate: e.target.value })}
                    className={INPUT_CLS}
                  />
                );
              }
              if (isZero) {
                return (
                  <input
                    type="text"
                    value="0"
                    disabled
                    className={cn(INPUT_CLS, "opacity-60 cursor-not-allowed bg-surface-container")}
                  />
                );
              }
              return (
                <input
                  type="number"
                  value={form.targetValue}
                  onChange={(e) => patch({ targetValue: e.target.value })}
                  placeholder={UOM_TYPE_META[form.uomType].inputPlaceholder}
                  min={0}
                  className={INPUT_CLS}
                />
              );
            })()}
          </div>

          <div className="col-span-12 md:col-span-4">
            <label className={LABEL_CLS}>Weightage</label>
            <div className="relative">
              <input
                type="number"
                value={form.weightage}
                onChange={(e) => patch({ weightage: e.target.value })}
                placeholder="e.g. 20"
                min={10}
                max={100}
                className={cn(INPUT_CLS, "pr-8 text-right")}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-on-surface-variant text-body-md pointer-events-none select-none">
                %
              </span>
            </div>
          </div>
        </div>

        {error && (
          <div className="px-sm py-2 rounded bg-error-container text-on-error-container text-body-md">
            {error}
          </div>
        )}

        <DialogFooter>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="px-md py-2 rounded-lg text-title-md text-on-surface hover:bg-surface-container border border-outline-variant transition-all disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="inline-flex items-center gap-sm bg-primary text-on-primary px-md py-2 rounded-lg text-title-md shadow-level-1 hover:opacity-90 transition-all disabled:opacity-60"
          >
            {submitting && (
              <span className="material-symbols-outlined animate-spin text-[18px]">progress_activity</span>
            )}
            {mode === "edit" ? "Apply Changes" : "Create Goal"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
