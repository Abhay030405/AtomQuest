import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/store/authStore";
import { useCycleStore } from "@/store/cycleStore";
import { useCreateGoal, useSubmitSheet } from "@/hooks/useGoals";
import { ROUTES } from "@/constants/routes";
import { ThrustArea, UoMType } from "@/types/goal.types";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";

const MAX_GOALS = 8;

interface DraftGoal {
  localId: string;
  title: string;
  description: string;
  thrustArea: ThrustArea;
  uomType: UoMType;
  targetValue: string;
  targetDate: string;
  weightage: string;
  collapsed: boolean;
}

function makeDraftGoal(): DraftGoal {
  return {
    localId: `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    title: "",
    description: "",
    thrustArea: ThrustArea.REVENUE_GROWTH,
    uomType: UoMType.MIN,
    targetValue: "",
    targetDate: "",
    weightage: "",
    collapsed: false,
  };
}

const INPUT_CLS =
  "w-full border border-outline-variant rounded bg-surface-container-lowest text-body-md text-on-surface h-10 px-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all";
const LABEL_CLS = "block text-label-md text-on-surface-variant uppercase tracking-wider mb-xs";

// ─── Goal Card ────────────────────────────────────────────────────────────────

interface GoalCardProps {
  goal: DraftGoal;
  index: number;
  onChange: (patch: Partial<DraftGoal>) => void;
  onRemove: () => void;
  onToggle: () => void;
  canRemove: boolean;
}

function GoalCard({ goal, index, onChange, onRemove, onToggle, canRemove }: GoalCardProps) {
  const isTimeline = goal.uomType === UoMType.TIMELINE;
  const isZero = goal.uomType === UoMType.ZERO;

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
      {/* Header */}
      <div className="bg-surface-container-low border-b border-outline-variant px-lg py-md flex items-center gap-md">
        <div className="w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-label-md font-semibold shrink-0">
          {index + 1}
        </div>
        <span className="flex-1 text-title-md text-on-surface truncate min-w-0">
          {goal.title.trim() || `New Goal ${index + 1}`}
        </span>
        <button
          type="button"
          onClick={onToggle}
          className="p-1 rounded text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
          title={goal.collapsed ? "Expand" : "Collapse"}
        >
          <span className="material-symbols-outlined text-[20px]">
            {goal.collapsed ? "expand_more" : "expand_less"}
          </span>
        </button>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="p-1 rounded text-on-surface-variant hover:text-error hover:bg-error-container transition-colors"
            title="Remove goal"
          >
            <span className="material-symbols-outlined text-[20px]">delete</span>
          </button>
        )}
      </div>

      {/* Body */}
      {!goal.collapsed && (
        <div className="p-lg">
          <div className="grid grid-cols-12 gap-md">
            {/* Thrust Area */}
            <div className="col-span-12 md:col-span-4">
              <label className={LABEL_CLS}>Thrust Area</label>
              <select
                value={goal.thrustArea}
                onChange={(e) => onChange({ thrustArea: e.target.value as ThrustArea })}
                className={INPUT_CLS}
              >
                {Object.values(ThrustArea).map((ta) => (
                  <option key={ta} value={ta}>
                    {formatThrustArea(ta)}
                  </option>
                ))}
              </select>
            </div>

            {/* Title */}
            <div className="col-span-12 md:col-span-8">
              <label className={LABEL_CLS}>Goal Title</label>
              <input
                type="text"
                value={goal.title}
                onChange={(e) => onChange({ title: e.target.value })}
                placeholder="e.g. Increase quarterly revenue by 15%"
                maxLength={200}
                className={INPUT_CLS}
              />
            </div>

            {/* Description */}
            <div className="col-span-12">
              <label className={LABEL_CLS}>
                Description{" "}
                <span className="normal-case text-outline">(optional)</span>
              </label>
              <textarea
                value={goal.description}
                onChange={(e) => onChange({ description: e.target.value })}
                placeholder="Describe the goal, measurement criteria, and expected outcomes…"
                rows={2}
                maxLength={500}
                className="w-full border border-outline-variant rounded bg-surface-container-lowest text-body-md text-on-surface px-sm py-sm focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all resize-none"
              />
            </div>

            {/* Unit of Measure */}
            <div className="col-span-12 md:col-span-4">
              <label className={LABEL_CLS}>Unit of Measure</label>
              <select
                value={goal.uomType}
                onChange={(e) =>
                  onChange({ uomType: e.target.value as UoMType, targetValue: "", targetDate: "" })
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

            {/* Target Value */}
            <div className="col-span-12 md:col-span-4">
              <label className={LABEL_CLS}>Target Value</label>
              {isTimeline ? (
                <input
                  type="date"
                  value={goal.targetDate}
                  onChange={(e) => onChange({ targetDate: e.target.value })}
                  className={INPUT_CLS}
                />
              ) : isZero ? (
                <input
                  type="text"
                  value="0"
                  disabled
                  className={cn(INPUT_CLS, "opacity-60 cursor-not-allowed bg-surface-container")}
                />
              ) : (
                <input
                  type="number"
                  value={goal.targetValue}
                  onChange={(e) => onChange({ targetValue: e.target.value })}
                  placeholder={UOM_TYPE_META[goal.uomType].inputPlaceholder}
                  min={0}
                  className={INPUT_CLS}
                />
              )}
            </div>

            {/* Weightage */}
            <div className="col-span-12 md:col-span-4">
              <label className={LABEL_CLS}>Weightage</label>
              <div className="relative">
                <input
                  type="number"
                  value={goal.weightage}
                  onChange={(e) => onChange({ weightage: e.target.value })}
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
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NewGoalSheetPage() {
  const navigate = useNavigate();
  const { currentUser } = useAuthStore();
  const { activeWindow, isLoading: cycleLoading, loadError: cycleError } = useCycleStore();
  const cycleId = activeWindow?.id ?? "";
  const userId = currentUser?.id ?? "";

  const [goals, setGoals] = useState<DraftGoal[]>([makeDraftGoal()]);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const createGoal = useCreateGoal();
  const submitSheet = useSubmitSheet(cycleId);

  if (cycleLoading) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
        <p className="text-body-md text-on-surface-variant">Loading cycle…</p>
      </div>
    );
  }

  if (!activeWindow) {
    return (
      <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto">
        <div className="bg-error-container border border-error/30 rounded-xl p-lg">
          <h2 className="text-headline-md text-on-error-container">No active cycle</h2>
          <p className="text-body-md text-on-error-container/80 mt-xs">
            {cycleError ??
              "There is no active goal-setting cycle right now. Please contact your administrator."}
          </p>
        </div>
      </div>
    );
  }

  const totalWeightage = goals.reduce((sum, g) => sum + (Number(g.weightage) || 0), 0);
  const canSubmit =
    totalWeightage === 100 && goals.every((g) => g.title.trim().length >= 3);

  function updateGoal(localId: string, patch: Partial<DraftGoal>) {
    setGoals((prev) => prev.map((g) => (g.localId === localId ? { ...g, ...patch } : g)));
  }

  function addGoal() {
    if (goals.length >= MAX_GOALS) return;
    setGoals((prev) => [...prev, makeDraftGoal()]);
  }

  function removeGoal(localId: string) {
    setGoals((prev) => prev.filter((g) => g.localId !== localId));
  }

  function toggleGoal(localId: string) {
    setGoals((prev) =>
      prev.map((g) => (g.localId === localId ? { ...g, collapsed: !g.collapsed } : g))
    );
  }

  async function persistGoals() {
    for (const g of goals) {
      if (!g.title.trim()) continue;
      await createGoal.mutateAsync({
        title: g.title.trim(),
        description: g.description.trim() || undefined,
        thrustArea: g.thrustArea,
        uomType: g.uomType,
        targetValue:
          g.uomType === UoMType.ZERO
            ? 0
            : g.uomType === UoMType.TIMELINE
            ? null
            : parseFloat(g.targetValue) || null,
        targetDate: g.uomType === UoMType.TIMELINE ? g.targetDate : undefined,
        weightage: Number(g.weightage) || 0,
        cycleId,
        userId,
      });
    }
  }

  async function handleSaveDraft() {
    setIsSaving(true);
    setSaveError(null);
    try {
      await persistGoals();
      setLastSaved(new Date());
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save draft");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleSubmit() {
    if (!canSubmit) return;
    setIsSaving(true);
    setSaveError(null);
    try {
      await persistGoals();
      await submitSheet.mutateAsync();
      navigate(ROUTES.EMPLOYEE.GOALS(userId));
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to submit sheet");
    } finally {
      setIsSaving(false);
    }
  }

  const lastSavedText = lastSaved
    ? `Last saved: ${lastSaved.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}`
    : "Not saved yet";

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto pb-[88px]">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-start gap-lg mb-xl border-b border-outline-variant pb-lg">
        <div className="flex-1">
          <h2 className="text-headline-lg text-on-surface">Annual Performance Goals</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">
            {activeWindow?.cycleName ?? "FY 2026"} · Define your objectives and submit for manager
            approval.
          </p>
        </div>

        {/* Weightage tracker */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-level-1 shrink-0 min-w-[200px]">
          <p className="text-label-md text-on-surface-variant uppercase tracking-wider mb-xs">
            Total Weightage
          </p>
          <p
            className={cn(
              "text-display-lg font-semibold leading-none",
              totalWeightage > 100
                ? "text-error"
                : totalWeightage === 100
                ? "text-tertiary"
                : "text-primary"
            )}
          >
            {totalWeightage}%
          </p>
          <div className="w-full bg-surface-container-high rounded-full h-1.5 my-sm">
            <div
              className={cn(
                "h-1.5 rounded-full transition-all",
                totalWeightage > 100
                  ? "bg-error"
                  : totalWeightage === 100
                  ? "bg-tertiary"
                  : "bg-primary"
              )}
              style={{ width: `${Math.min(totalWeightage, 100)}%` }}
            />
          </div>
          {totalWeightage < 100 && (
            <p className="text-label-md text-error">{100 - totalWeightage}% remaining</p>
          )}
          {totalWeightage === 100 && (
            <p className="text-label-md text-tertiary flex items-center gap-xs">
              <span className="material-symbols-outlined text-[14px]">check_circle</span>
              Complete
            </p>
          )}
          {totalWeightage > 100 && (
            <p className="text-label-md text-error">Over by {totalWeightage - 100}%</p>
          )}
        </div>
      </div>

      {/* Goal cards */}
      <div className="space-y-md">
        {goals.map((goal, index) => (
          <GoalCard
            key={goal.localId}
            goal={goal}
            index={index}
            onChange={(patch) => updateGoal(goal.localId, patch)}
            onRemove={() => removeGoal(goal.localId)}
            onToggle={() => toggleGoal(goal.localId)}
            canRemove={goals.length > 1}
          />
        ))}
      </div>

      {/* Add another goal */}
      {goals.length < MAX_GOALS && (
        <button
          type="button"
          onClick={addGoal}
          className="mt-md w-full border-2 border-dashed border-outline-variant rounded-xl py-md flex items-center justify-center gap-sm text-body-md text-on-surface-variant hover:bg-surface-container hover:text-primary hover:border-primary transition-all"
        >
          <span className="material-symbols-outlined text-[20px]">add_circle</span>
          Add Another Goal ({goals.length} of {MAX_GOALS})
        </button>
      )}

      {/* Fixed bottom action bar */}
      <div className="fixed bottom-0 left-0 right-0 md:left-64 bg-surface-container-lowest border-t border-outline-variant px-lg py-sm shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] flex items-center gap-md z-40">
        <span className="text-label-md text-on-surface-variant hidden sm:block shrink-0">
          {lastSavedText}
        </span>
        {saveError && (
          <span className="text-label-md text-error truncate" title={saveError}>
            {saveError}
          </span>
        )}
        <div className="flex items-center gap-sm ml-auto">
          <button
            type="button"
            onClick={() => navigate(ROUTES.EMPLOYEE.GOALS(userId))}
            className="text-error text-label-md px-md py-sm rounded-lg hover:bg-error/5 transition-colors"
          >
            Discard Changes
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={isSaving}
            className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg shadow-level-1 hover:bg-surface-container-low transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSaving ? "Saving…" : "Save as Draft"}
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || isSaving || submitSheet.isPending}
            title={!canSubmit ? "Weightage must equal 100% and all goals need a title" : undefined}
            className="bg-primary text-on-primary text-label-md px-md py-sm rounded-lg hover:opacity-90 transition-opacity flex items-center gap-xs border-t border-white/20 shadow-level-1 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span className="material-symbols-outlined text-[16px]">send</span>
            {submitSheet.isPending ? "Submitting…" : "Submit for Approval"}
          </button>
        </div>
      </div>
    </div>
  );
}
