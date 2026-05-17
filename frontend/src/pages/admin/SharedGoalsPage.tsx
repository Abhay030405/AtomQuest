import { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { usePushSharedGoal, useAdminPushedSharedGoals } from "@/hooks/useAdmin";
import { useAllUsers } from "@/hooks/useApprovals";
import { useCycleStore } from "@/store/cycleStore";
import { ThrustArea, UoMType } from "@/types/goal.types";
import { UserRole } from "@/types/user.types";
import type { User } from "@/types/user.types";
import type { PushedSharedGoal } from "@/services/admin.service";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";

const kpiSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters"),
    description: z.string().optional(),
    thrustArea: z.nativeEnum(ThrustArea),
    uomType: z.nativeEnum(UoMType),
    targetValue: z.coerce.number().min(0).optional(),
    targetDate: z.string().optional(),
    weightage: z.coerce.number().min(10, "Min 10").max(90, "Max 90"),
  })
  .superRefine((val, ctx) => {
    if (val.uomType === UoMType.TIMELINE && !val.targetDate) {
      ctx.addIssue({ code: "custom", path: ["targetDate"], message: "Target date is required" });
    }
    if (val.uomType !== UoMType.TIMELINE && val.uomType !== UoMType.ZERO && !val.targetValue) {
      ctx.addIssue({ code: "custom", path: ["targetValue"], message: "Target value is required" });
    }
  });

type KpiFormData = z.infer<typeof kpiSchema>;

const INPUT_CLS = "w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none transition-all";
const SELECT_CLS = "w-full px-sm py-sm bg-surface-container-lowest border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:outline-none";

// ─── Step indicator ───────────────────────────────────────────────────────────

function StepIndicator({ step }: { step: 1 | 2 | 3 }) {
  const steps = [
    { n: 1, label: "Define KPI" },
    { n: 2, label: "Select Recipients" },
    { n: 3, label: "Review & Push" },
  ] as const;

  return (
    <div className="flex items-center gap-0">
      {steps.map(({ n, label }, i) => {
        const done = step > n;
        const active = step === n;
        const isLast = i === steps.length - 1;
        return (
          <div key={n} className="flex items-center">
            <div className="flex flex-col items-center gap-xs min-w-[80px]">
              <div className={cn(
                "h-7 w-7 rounded-full border-2 flex items-center justify-center text-label-md font-bold",
                done && "border-primary bg-primary text-on-primary",
                active && "border-primary bg-primary/10 text-primary ring-2 ring-primary/20",
                !done && !active && "border-outline-variant bg-surface-container text-on-surface-variant"
              )}>
                {done ? <span className="material-symbols-outlined text-[14px]">check</span> : n}
              </div>
              <span className={cn(
                "text-label-md text-center",
                active && "text-primary font-bold",
                done && "text-primary",
                !done && !active && "text-on-surface-variant/60"
              )}>
                {label}
              </span>
            </div>
            {!isLast && (
              <div className={cn("h-px w-6 mx-xs mb-md", done ? "bg-primary/30" : "bg-outline-variant")} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Step 1: Define KPI ───────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: (data: KpiFormData) => void }) {
  const form = useForm<KpiFormData>({
    resolver: zodResolver(kpiSchema) as any,
    defaultValues: {
      title: "",
      description: "",
      thrustArea: ThrustArea.REVENUE_GROWTH,
      uomType: UoMType.MIN,
      weightage: 10,
    },
  });

  const watchedUom = form.watch("uomType");

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onNext)} className="space-y-md">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-label-md text-on-surface">KPI Title *</FormLabel>
              <FormControl>
                <input {...field} placeholder="e.g. Achieve Q1 Sales Revenue Target" className={INPUT_CLS} />
              </FormControl>
              <FormMessage className="text-label-md text-error" />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel className="text-label-md text-on-surface">Description</FormLabel>
              <FormControl>
                <input {...field} placeholder="Optional context for this KPI" className={INPUT_CLS} />
              </FormControl>
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-md">
          <FormField
            control={form.control}
            name="thrustArea"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface">Thrust Area *</FormLabel>
                <FormControl>
                  <select {...field} className={SELECT_CLS}>
                    {Object.values(ThrustArea).map((t) => (
                      <option key={t} value={t}>{formatThrustArea(t)}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage className="text-label-md text-error" />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="uomType"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface">Measurement Type *</FormLabel>
                <FormControl>
                  <select {...field} className={SELECT_CLS}>
                    {Object.values(UoMType).map((u) => (
                      <option key={u} value={u}>{UOM_TYPE_META[u].label}</option>
                    ))}
                  </select>
                </FormControl>
                <FormMessage className="text-label-md text-error" />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-md">
          {watchedUom === UoMType.TIMELINE ? (
            <FormField
              control={form.control}
              name="targetDate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-label-md text-on-surface">Target Date *</FormLabel>
                  <FormControl>
                    <input type="date" {...field} className={INPUT_CLS} />
                  </FormControl>
                  <FormMessage className="text-label-md text-error" />
                </FormItem>
              )}
            />
          ) : watchedUom !== UoMType.ZERO ? (
            <FormField
              control={form.control}
              name="targetValue"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-label-md text-on-surface">Target Value *</FormLabel>
                  <FormControl>
                    <input
                      type="number"
                      min={0}
                      placeholder={UOM_TYPE_META[watchedUom].inputPlaceholder}
                      {...field}
                      className={INPUT_CLS}
                    />
                  </FormControl>
                  <FormMessage className="text-label-md text-error" />
                </FormItem>
              )}
            />
          ) : (
            <div>
              <label className="text-label-md text-on-surface block mb-xs">Target Value</label>
              <div className="px-sm py-sm border border-outline-variant rounded-lg bg-surface-container text-body-md text-on-surface-variant">
                0 (Zero)
              </div>
            </div>
          )}

          <FormField
            control={form.control}
            name="weightage"
            render={({ field }) => (
              <FormItem>
                <FormLabel className="text-label-md text-on-surface">Weightage (%) *</FormLabel>
                <FormControl>
                  <input type="number" min={10} max={90} {...field} className={INPUT_CLS} />
                </FormControl>
                <FormMessage className="text-label-md text-error" />
              </FormItem>
            )}
          />
        </div>

        <div className="flex justify-end pt-sm">
          <button type="submit" className="bg-primary text-on-primary text-label-md px-lg py-sm rounded-lg shadow-level-1 border-t border-white/20 hover:opacity-90 transition-all flex items-center gap-xs">
            Next: Select Recipients
            <span className="material-symbols-outlined text-[18px]">chevron_right</span>
          </button>
        </div>
      </form>
    </Form>
  );
}

// ─── Step 2: Select Recipients ────────────────────────────────────────────────

function Step2({ employees, selected, onChange, onBack, onNext }: {
  employees: User[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((s) => s !== id) : [...selected, id]);
  }

  function toggleAll() {
    onChange(selected.length === employees.length ? [] : employees.map((u) => u.id));
  }

  return (
    <div className="space-y-md">
      <div className="flex items-center justify-between">
        <p className="text-body-md text-on-surface-variant">Select employees who will receive this shared KPI</p>
        <button onClick={toggleAll} className="text-primary text-label-md hover:underline transition-colors">
          {selected.length === employees.length ? "Deselect all" : "Select all"}
        </button>
      </div>

      {employees.length === 0 ? (
        <div className="text-body-md text-on-surface-variant border border-dashed border-outline-variant rounded-lg p-lg text-center">
          No employees found.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-sm">
          {employees.map((user) => {
          const isSelected = selected.includes(user.id);
          const initials = user.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
          return (
            <label
              key={user.id}
              className={cn(
                "flex items-center gap-md p-md rounded-lg border cursor-pointer transition-colors",
                isSelected
                  ? "border-primary bg-primary/5"
                  : "border-outline-variant hover:bg-surface-container-low"
              )}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => toggle(user.id)}
                className="w-4 h-4 rounded border-outline-variant text-primary focus:ring-primary/20"
              />
              <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md shrink-0">
                {initials}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-body-md text-on-surface font-medium">{user.fullName}</p>
                <p className="text-label-md text-on-surface-variant">
                  {user.departmentName} · {user.employeeCode}
                  {user.managerName ? ` (Manager: ${user.managerName})` : ""}
                </p>
              </div>
              {isSelected && (
                <span className="material-symbols-outlined text-primary text-[18px] shrink-0">check_circle</span>
              )}
            </label>
          );
        })}
        </div>
      )}

      <div className="flex items-center justify-between pt-sm">
        <button onClick={onBack} className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          Back
        </button>
        <button
          onClick={onNext}
          disabled={selected.length === 0}
          className="bg-primary text-on-primary text-label-md px-lg py-sm rounded-lg shadow-level-1 border-t border-white/20 hover:opacity-90 transition-all flex items-center gap-xs disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Next: Review
          <span className="material-symbols-outlined text-[18px]">chevron_right</span>
        </button>
      </div>
    </div>
  );
}

// ─── Step 3: Review & Push ────────────────────────────────────────────────────

function Step3({ employees, kpiData, selectedUserIds, isPending, onBack, onPush }: {
  employees: User[];
  kpiData: KpiFormData;
  selectedUserIds: string[];
  isPending: boolean;
  onBack: () => void;
  onPush: () => void;
}) {
  const selectedUsers = employees.filter((u) => selectedUserIds.includes(u.id));
  const uomMeta = UOM_TYPE_META[kpiData.uomType];

  let targetDisplay = "";
  if (kpiData.uomType === UoMType.ZERO) targetDisplay = "0 (Zero)";
  else if (kpiData.uomType === UoMType.TIMELINE) targetDisplay = kpiData.targetDate ?? "—";
  else targetDisplay = String(kpiData.targetValue ?? "—");

  return (
    <div className="space-y-md">
      {/* KPI summary */}
      <div className="rounded-lg border border-outline-variant p-lg space-y-md bg-surface-container-lowest">
        <div className="flex items-start justify-between gap-md">
          <div>
            <p className="text-title-md text-on-surface">{kpiData.title}</p>
            {kpiData.description && (
              <p className="text-body-md text-on-surface-variant mt-xs">{kpiData.description}</p>
            )}
          </div>
          <span className="bg-secondary-container text-on-secondary-container text-label-md px-2 py-1 rounded shrink-0">
            Shared KPI
          </span>
        </div>
        <div className="grid grid-cols-3 gap-md border-t border-outline-variant pt-md">
          <div>
            <p className="text-label-md text-on-surface-variant mb-xs">Area</p>
            <p className="text-body-md text-on-surface font-medium">{formatThrustArea(kpiData.thrustArea)}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant mb-xs">Measurement</p>
            <p className="text-body-md text-on-surface font-medium">{uomMeta.label}</p>
          </div>
          <div>
            <p className="text-label-md text-on-surface-variant mb-xs">Target</p>
            <p className="text-body-md text-on-surface font-medium">{targetDisplay}</p>
          </div>
        </div>
        <div>
          <p className="text-label-md text-on-surface-variant mb-xs">Weightage</p>
          <p className="text-title-md text-on-surface">{kpiData.weightage}%</p>
        </div>
      </div>

      {/* Recipients */}
      <div>
        <div className="flex items-center gap-sm mb-sm">
          <span className="material-symbols-outlined text-on-surface-variant text-[18px]">group</span>
          <p className="text-body-md text-on-surface font-medium">
            {selectedUsers.length} recipient{selectedUsers.length !== 1 ? "s" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-sm">
          {selectedUsers.map((u) => {
            const initials = u.fullName.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
            return (
              <span key={u.id} className="inline-flex items-center gap-xs bg-surface-container border border-outline-variant text-label-md px-sm py-xs rounded-full">
                <span className="w-4 h-4 rounded-full bg-primary-container text-on-primary-container text-[8px] font-bold flex items-center justify-center">
                  {initials}
                </span>
                {u.fullName}
              </span>
            );
          })}
        </div>
      </div>

      <div className="text-body-md text-on-surface-variant bg-surface-container-low px-md py-sm rounded-lg border border-outline-variant/50">
        Each recipient will receive this as a draft goal in their FY 2026 goal sheet, marked as a Shared KPI. They can view but not delete it.
      </div>

      <div className="flex items-center justify-between pt-sm">
        <button onClick={onBack} className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors flex items-center gap-xs">
          <span className="material-symbols-outlined text-[18px]">chevron_left</span>
          Back
        </button>
        <button
          disabled={isPending}
          onClick={onPush}
          className="bg-primary text-on-primary text-label-md px-lg py-sm rounded-lg shadow-level-1 border-t border-white/20 hover:opacity-90 transition-all flex items-center gap-xs disabled:opacity-50"
        >
          <span className="material-symbols-outlined text-[18px]">share</span>
          {isPending ? "Pushing…" : `Push to ${selectedUsers.length} employee${selectedUsers.length !== 1 ? "s" : ""}`}
        </button>
      </div>
    </div>
  );
}

// ─── SharedGoalsPage ──────────────────────────────────────────────────────────

export default function SharedGoalsPage() {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [kpiData, setKpiData] = useState<KpiFormData | null>(null);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);

  const push = usePushSharedGoal();
  const { data: allUsers, isLoading: usersLoading } = useAllUsers();
  const activeCycleId = useCycleStore((s) => s.activeWindow?.id);
  const employees = useMemo<User[]>(
    () => (allUsers ?? []).filter((u) => u.role === UserRole.EMPLOYEE && u.isActive),
    [allUsers]
  );

  function handleStep1(data: KpiFormData) {
    setKpiData(data);
    setStep(2);
  }

  function handlePush() {
    if (!kpiData) return;
    push.mutate(
      {
        kpiData: { ...kpiData, targetValue: kpiData.targetValue ?? null },
        targetUserIds: selectedUserIds,
        cycleId: activeCycleId,
      },
      {
        onSuccess: () => {
          setStep(1);
          setKpiData(null);
          setSelectedUserIds([]);
        },
      }
    );
  }

  const STEP_LABELS = { 1: "Define the shared KPI", 2: "Select recipient employees", 3: "Review and push" };
  const STEP_ICONS = { 1: "target", 2: "group", 3: "share" };

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="border-b border-outline-variant pb-md">
        <h2 className="text-headline-lg text-on-surface">Shared Goal Push</h2>
        <p className="text-body-lg text-on-surface-variant mt-xs">
          Define a shared KPI and push it to selected employees as a draft goal.
        </p>
      </div>

      {/* Wizard card */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
        {/* Card header band */}
        <div className="bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-outline-variant px-xl py-lg">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-md">
            <div className="flex items-center gap-md">
              <div className="h-10 w-10 rounded-lg bg-primary text-on-primary flex items-center justify-center shadow-level-1">
                <span className="material-symbols-outlined text-[22px]">{STEP_ICONS[step]}</span>
              </div>
              <div>
                <p className="text-label-md text-on-surface-variant uppercase tracking-wide">Step {step} of 3</p>
                <p className="text-title-lg text-on-surface font-semibold">{STEP_LABELS[step]}</p>
              </div>
            </div>
            <StepIndicator step={step} />
          </div>
        </div>

        {/* Card body */}
        <div className="p-xl space-y-lg">
          {!activeCycleId && (
            <div className="text-body-md text-on-error-container bg-error-container/30 border border-error/30 rounded-lg px-md py-sm">
              No active cycle window. Activate a cycle in Cycle Config before pushing shared goals.
            </div>
          )}

          {/* Step content */}
          {step === 1 && <Step1 onNext={handleStep1} />}

          {step === 2 && (
            <Step2
              employees={employees}
              selected={selectedUserIds}
              onChange={setSelectedUserIds}
              onBack={() => setStep(1)}
              onNext={() => setStep(3)}
            />
          )}

          {step === 2 && usersLoading && (
            <p className="text-body-md text-on-surface-variant">Loading employees…</p>
          )}

          {step === 3 && kpiData && (
            <Step3
              employees={employees}
              kpiData={kpiData}
              selectedUserIds={selectedUserIds}
              isPending={push.isPending}
              onBack={() => setStep(2)}
              onPush={handlePush}
            />
          )}
        </div>
      </div>

      {/* History of pushed KPIs */}
      <PushedKpiHistory cycleId={activeCycleId} />
    </div>
  );
}

// ─── History section ──────────────────────────────────────────────────────────

function PushedKpiHistory({ cycleId }: { cycleId: string | undefined }) {
  const { data, isLoading, isError } = useAdminPushedSharedGoals(cycleId);

  const grouped = useMemo(() => {
    if (!data) return [] as Array<{
      sourceGoalId: string;
      title: string;
      description: string | null;
      thrustArea: ThrustArea | null;
      uomType: UoMType | null;
      targetValue: number | null;
      targetDate: string | null;
      weightage: number;
      pushedAt: string;
      recipients: PushedSharedGoal[];
    }>;
    const map = new Map<string, ReturnType<typeof toGroup>>();
    function toGroup(g: PushedSharedGoal) {
      return {
        sourceGoalId: g.sourceGoalId,
        title: g.sourceGoalTitle,
        description: g.sourceGoalDescription,
        thrustArea: g.sourceGoalThrustArea,
        uomType: g.sourceGoalUomType,
        targetValue: g.sourceGoalTargetValue,
        targetDate: g.sourceGoalTargetDate,
        weightage: g.sourceGoalWeightage,
        pushedAt: g.pushedAt,
        recipients: [g],
      };
    }
    for (const g of data) {
      const existing = map.get(g.sourceGoalId);
      if (existing) {
        existing.recipients.push(g);
        if (new Date(g.pushedAt) > new Date(existing.pushedAt)) existing.pushedAt = g.pushedAt;
      } else {
        map.set(g.sourceGoalId, toGroup(g));
      }
    }
    return Array.from(map.values()).sort(
      (a, b) => new Date(b.pushedAt).getTime() - new Date(a.pushedAt).getTime(),
    );
  }, [data]);

  return (
    <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
      <div className="flex items-center justify-between px-xl py-md border-b border-outline-variant bg-surface-container-low">
        <div className="flex items-center gap-sm">
          <span className="material-symbols-outlined text-on-surface-variant">history</span>
          <h3 className="text-title-md text-on-surface font-semibold">Previously pushed KPIs</h3>
        </div>
        <span className="text-label-md text-on-surface-variant">
          {grouped.length} KPI{grouped.length !== 1 ? "s" : ""}
        </span>
      </div>

      <div className="p-xl">
        {!cycleId && (
          <p className="text-body-md text-on-surface-variant text-center py-lg">
            Activate a cycle to view push history.
          </p>
        )}
        {cycleId && isLoading && (
          <p className="text-body-md text-on-surface-variant text-center py-lg">Loading history…</p>
        )}
        {cycleId && isError && (
          <p className="text-body-md text-error text-center py-lg">Failed to load history.</p>
        )}
        {cycleId && !isLoading && !isError && grouped.length === 0 && (
          <div className="text-body-md text-on-surface-variant border border-dashed border-outline-variant rounded-lg p-lg text-center">
            No KPIs have been pushed in this cycle yet.
          </div>
        )}
        {cycleId && grouped.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-md">
            {grouped.map((k) => {
              let targetDisplay = "—";
              if (k.uomType === UoMType.ZERO) targetDisplay = "0";
              else if (k.uomType === UoMType.TIMELINE) targetDisplay = k.targetDate ?? "—";
              else if (k.targetValue !== null) targetDisplay = String(k.targetValue);
              return (
                <div
                  key={k.sourceGoalId}
                  className="border border-outline-variant rounded-lg p-md bg-surface-container-low hover:shadow-level-1 transition-shadow"
                >
                  <div className="flex items-start justify-between gap-md mb-sm">
                    <div className="min-w-0">
                      <p className="text-title-md text-on-surface font-semibold truncate">{k.title}</p>
                      {k.description && (
                        <p className="text-body-md text-on-surface-variant mt-xs line-clamp-2">
                          {k.description}
                        </p>
                      )}
                    </div>
                    <span className="bg-secondary-container text-on-secondary-container text-label-md px-2 py-1 rounded shrink-0">
                      Shared
                    </span>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-sm border-t border-outline-variant pt-sm">
                    <div>
                      <p className="text-label-md text-on-surface-variant">Area</p>
                      <p className="text-body-md text-on-surface font-medium">
                        {k.thrustArea ? formatThrustArea(k.thrustArea) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-label-md text-on-surface-variant">Target</p>
                      <p className="text-body-md text-on-surface font-medium">{targetDisplay}</p>
                    </div>
                    <div>
                      <p className="text-label-md text-on-surface-variant">Weightage</p>
                      <p className="text-body-md text-on-surface font-medium">{k.weightage}%</p>
                    </div>
                    <div>
                      <p className="text-label-md text-on-surface-variant">Pushed</p>
                      <p className="text-body-md text-on-surface font-medium">
                        {new Date(k.pushedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-sm pt-sm border-t border-outline-variant">
                    <div className="flex items-center gap-xs mb-xs">
                      <span className="material-symbols-outlined text-on-surface-variant text-[16px]">group</span>
                      <p className="text-label-md text-on-surface-variant">
                        {k.recipients.length} recipient{k.recipients.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-xs">
                      {k.recipients.slice(0, 6).map((r) => (
                        <span
                          key={r.id}
                          className="inline-flex items-center bg-surface-container border border-outline-variant text-label-md px-sm py-xs rounded-full"
                        >
                          {r.recipientName}
                        </span>
                      ))}
                      {k.recipients.length > 6 && (
                        <span className="text-label-md text-on-surface-variant px-sm py-xs">
                          +{k.recipients.length - 6} more
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
