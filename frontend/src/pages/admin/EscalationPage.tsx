import { useState, useEffect } from "react";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import {
  useEscalationRules,
  useCreateEscalationRule,
  useUpdateEscalationRule,
  useDeleteEscalationRule,
  useEscalationLogs,
  useEscalationRunNow,
} from "@/hooks/useEscalation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type {
  ChainStep,
  ChainTarget,
  EscalationRule,
  EscalationTrigger,
} from "@/types/escalation.types";
import {
  TARGET_LABELS,
  TRIGGER_DESCRIPTIONS,
  TRIGGER_LABELS,
} from "@/types/escalation.types";

// ─── Constants ────────────────────────────────────────────────────────────────

const TRIGGER_OPTIONS: EscalationTrigger[] = [
  "goals_not_submitted",
  "manager_approval_overdue",
  "checkin_not_completed",
];

const TARGET_OPTIONS: ChainTarget[] = ["self", "manager", "hr"];

const TARGET_ICONS: Record<ChainTarget, string> = {
  self: "person",
  manager: "supervisor_account",
  hr: "admin_panel_settings",
};

const TARGET_COLORS: Record<ChainTarget, string> = {
  self: "bg-tertiary-container/30 text-tertiary",
  manager: "bg-secondary-container/40 text-on-secondary-container",
  hr: "bg-error-container/30 text-on-error-container",
};

// ─── Blank form ───────────────────────────────────────────────────────────────

function blankForm() {
  return {
    name: "",
    trigger_condition: "goals_not_submitted" as EscalationTrigger,
    threshold_days: 3,
    escalation_chain: [
      { target: "self" as ChainTarget, delay_days: 0 },
      { target: "manager" as ChainTarget, delay_days: 3 },
      { target: "hr" as ChainTarget, delay_days: 5 },
    ] as ChainStep[],
    notification_title_template: "Action Required: {full_name}",
    notification_body_template:
      "This is a reminder that an action is pending. Please complete it at your earliest convenience.",
    is_active: true,
  };
}

// ─── Rule Form Dialog ─────────────────────────────────────────────────────────

interface RuleFormProps {
  open: boolean;
  onClose: () => void;
  existing?: EscalationRule | null;
}

function RuleFormDialog({ open, onClose, existing }: RuleFormProps) {
  const create = useCreateEscalationRule();
  const update = useUpdateEscalationRule();
  const isEdit = Boolean(existing);

  const [form, setForm] = useState(() =>
    existing
      ? {
          name: existing.name,
          trigger_condition: existing.trigger_condition,
          threshold_days: existing.threshold_days,
          escalation_chain: existing.escalation_chain.map((s) => ({ ...s })),
          notification_title_template: existing.notification_title_template,
          notification_body_template: existing.notification_body_template,
          is_active: existing.is_active,
        }
      : blankForm(),
  );

  // Reset form whenever the rule being edited changes
  useEffect(() => {
    setForm(
      existing
        ? {
            name: existing.name,
            trigger_condition: existing.trigger_condition,
            threshold_days: existing.threshold_days,
            escalation_chain: existing.escalation_chain.map((s) => ({ ...s })),
            notification_title_template: existing.notification_title_template,
            notification_body_template: existing.notification_body_template,
            is_active: existing.is_active,
          }
        : blankForm(),
    );
  }, [existing?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateChainStep(idx: number, patch: Partial<ChainStep>) {
    setForm((f) => ({
      ...f,
      escalation_chain: f.escalation_chain.map((s, i) =>
        i === idx ? { ...s, ...patch } : s,
      ),
    }));
  }

  function addChainStep() {
    setForm((f) => ({
      ...f,
      escalation_chain: [
        ...f.escalation_chain,
        {
          target: "hr" as ChainTarget,
          delay_days:
            (f.escalation_chain[f.escalation_chain.length - 1]?.delay_days ?? 0) + 2,
        },
      ],
    }));
  }

  function removeChainStep(idx: number) {
    setForm((f) => ({
      ...f,
      escalation_chain: f.escalation_chain.filter((_, i) => i !== idx),
    }));
  }

  async function handleSubmit() {
    if (!form.name.trim()) {
      toast.error("Rule name is required.");
      return;
    }
    if (form.escalation_chain.length === 0) {
      toast.error("At least one escalation step is required.");
      return;
    }
    // Validate delay_days ascending
    for (let i = 1; i < form.escalation_chain.length; i++) {
      if (form.escalation_chain[i].delay_days <= form.escalation_chain[i - 1].delay_days) {
        toast.error("Delay days must be strictly ascending across chain steps.");
        return;
      }
    }

    if (isEdit && existing) {
      await update.mutateAsync({ id: existing.id, patch: form });
    } else {
      await create.mutateAsync(form);
    }
    onClose();
  }

  const isPending = create.isPending || update.isPending;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Escalation Rule" : "Create Escalation Rule"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-lg pt-sm">
          {/* Name */}
          <div>
            <label className="text-label-md font-medium text-on-surface-variant block mb-xs">
              Rule Name
            </label>
            <input
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              placeholder="e.g. Goal Submission Reminder"
            />
          </div>

          {/* Trigger */}
          <div>
            <label className="text-label-md font-medium text-on-surface-variant block mb-xs">
              Trigger Condition
            </label>
            <select
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.trigger_condition}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  trigger_condition: e.target.value as EscalationTrigger,
                }))
              }
            >
              {TRIGGER_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {TRIGGER_LABELS[t]}
                </option>
              ))}
            </select>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              {TRIGGER_DESCRIPTIONS[form.trigger_condition]}
            </p>
          </div>

          {/* Threshold days */}
          <div>
            <label className="text-label-md font-medium text-on-surface-variant block mb-xs">
              Threshold Days (N)
            </label>
            <input
              type="number"
              min={1}
              className="w-40 border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.threshold_days}
              onChange={(e) =>
                setForm((f) => ({ ...f, threshold_days: Number(e.target.value) }))
              }
            />
            <p className="text-body-sm text-on-surface-variant mt-xs">
              Trigger fires N days after the condition window opens.
            </p>
          </div>

          {/* Escalation chain */}
          <div>
            <div className="flex items-center justify-between mb-sm">
              <label className="text-label-md font-medium text-on-surface-variant">
                Escalation Chain
              </label>
              <button
                type="button"
                onClick={addChainStep}
                className="flex items-center gap-xs text-label-sm text-primary hover:underline"
              >
                <span className="material-symbols-outlined text-[16px]">add</span>
                Add Step
              </button>
            </div>
            <div className="space-y-sm">
              {form.escalation_chain.map((step, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-sm bg-surface-container-low rounded-xl p-sm border border-outline-variant"
                >
                  <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container text-label-sm font-bold flex items-center justify-center shrink-0">
                    {idx + 1}
                  </div>
                  <select
                    className="flex-1 border border-outline-variant rounded-lg px-sm py-xs text-body-sm bg-surface focus:outline-none focus:ring-1 focus:ring-primary"
                    value={step.target}
                    onChange={(e) =>
                      updateChainStep(idx, { target: e.target.value as ChainTarget })
                    }
                  >
                    {TARGET_OPTIONS.map((t) => (
                      <option key={t} value={t}>
                        {TARGET_LABELS[t]}
                      </option>
                    ))}
                  </select>
                  <div className="flex items-center gap-xs shrink-0">
                    <span className="text-label-sm text-on-surface-variant">after</span>
                    <input
                      type="number"
                      min={0}
                      className="w-16 border border-outline-variant rounded-lg px-sm py-xs text-body-sm bg-surface text-center focus:outline-none focus:ring-1 focus:ring-primary"
                      value={step.delay_days}
                      onChange={(e) =>
                        updateChainStep(idx, { delay_days: Number(e.target.value) })
                      }
                    />
                    <span className="text-label-sm text-on-surface-variant">days</span>
                  </div>
                  {form.escalation_chain.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeChainStep(idx)}
                      className="text-on-surface-variant hover:text-error transition-colors"
                    >
                      <span className="material-symbols-outlined text-[18px]">delete</span>
                    </button>
                  )}
                </div>
              ))}
            </div>
            <p className="text-body-sm text-on-surface-variant mt-xs">
              Delay is relative to when the trigger first fires.
            </p>
          </div>

          {/* Templates */}
          <div>
            <label className="text-label-md font-medium text-on-surface-variant block mb-xs">
              Notification Title Template
            </label>
            <input
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.notification_title_template}
              onChange={(e) =>
                setForm((f) => ({ ...f, notification_title_template: e.target.value }))
              }
              placeholder="e.g. Reminder for {full_name}"
            />
          </div>
          <div>
            <label className="text-label-md font-medium text-on-surface-variant block mb-xs">
              Notification Body Template
            </label>
            <textarea
              rows={3}
              className="w-full border border-outline-variant rounded-lg px-md py-sm text-body-md bg-surface focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              value={form.notification_body_template}
              onChange={(e) =>
                setForm((f) => ({ ...f, notification_body_template: e.target.value }))
              }
              placeholder="Use {full_name}, {email}, {days_elapsed} as placeholders."
            />
            <p className="text-body-sm text-on-surface-variant mt-xs">
              Available tokens: <code className="bg-surface-container px-xs rounded text-xs">{"{full_name}"}</code>{" "}
              <code className="bg-surface-container px-xs rounded text-xs">{"{email}"}</code>{" "}
              <code className="bg-surface-container px-xs rounded text-xs">{"{days_elapsed}"}</code>
            </p>
          </div>

          {/* Active toggle */}
          <label className="flex items-center gap-md cursor-pointer">
            <div
              onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
              className={cn(
                "w-11 h-6 rounded-full transition-colors flex items-center px-[3px]",
                form.is_active ? "bg-primary" : "bg-outline-variant",
              )}
            >
              <div
                className={cn(
                  "w-[18px] h-[18px] rounded-full bg-white shadow transition-transform duration-200",
                  form.is_active ? "translate-x-5" : "translate-x-0",
                )}
              />
            </div>
            <span className="text-body-md text-on-surface">
              {form.is_active ? "Active" : "Inactive"}
            </span>
          </label>
        </div>

        <DialogFooter className="pt-md gap-sm">
          <button
            type="button"
            onClick={onClose}
            className="px-lg py-sm rounded-xl border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending}
            className="px-lg py-sm rounded-xl bg-primary text-on-primary text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Saving…" : isEdit ? "Save Changes" : "Create Rule"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Confirm delete dialog ────────────────────────────────────────────────────

interface ConfirmDeleteProps {
  open: boolean;
  ruleName: string;
  onConfirm: () => void;
  onClose: () => void;
  isPending: boolean;
}

function ConfirmDeleteDialog({
  open,
  ruleName,
  onConfirm,
  onClose,
  isPending,
}: ConfirmDeleteProps) {
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Delete Rule</DialogTitle>
        </DialogHeader>
        <p className="text-body-md text-on-surface-variant pt-sm">
          Delete <span className="font-semibold text-on-surface">{ruleName}</span>? This cannot be undone. Existing log entries will be retained.
        </p>
        <DialogFooter className="gap-sm pt-md">
          <button
            type="button"
            onClick={onClose}
            className="px-lg py-sm rounded-xl border border-outline-variant text-label-md text-on-surface-variant hover:bg-surface-container-low transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="px-lg py-sm rounded-xl bg-error text-on-error text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {isPending ? "Deleting…" : "Delete"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Rules Tab ────────────────────────────────────────────────────────────────

function RulesTab() {
  const { data: rules = [], isLoading } = useEscalationRules();
  const deleteRule = useDeleteEscalationRule();
  const updateRule = useUpdateEscalationRule();

  const [showForm, setShowForm] = useState(false);
  const [editRule, setEditRule] = useState<EscalationRule | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EscalationRule | null>(null);

  function openCreate() {
    setEditRule(null);
    setShowForm(true);
  }

  function openEdit(rule: EscalationRule) {
    setEditRule(rule);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditRule(null);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    await deleteRule.mutateAsync(deleteTarget.id);
    setDeleteTarget(null);
  }

  async function toggleActive(rule: EscalationRule) {
    await updateRule.mutateAsync({ id: rule.id, patch: { is_active: !rule.is_active } });
  }

  return (
    <>
      <div className="flex items-center justify-between mb-lg">
        <p className="text-body-md text-on-surface-variant">
          Configure which inactions trigger notifications and how the escalation chain progresses.
        </p>
        <button
          onClick={openCreate}
          className="flex items-center gap-xs bg-primary text-on-primary text-label-md font-medium px-lg py-sm rounded-xl hover:opacity-90 transition-opacity shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">add</span>
          New Rule
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-sm">
          {[1, 2, 3].map((k) => (
            <div
              key={k}
              className="h-20 rounded-xl bg-surface-container-low animate-pulse"
            />
          ))}
        </div>
      ) : rules.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] mb-md block opacity-40">
            rule_settings
          </span>
          <p className="text-body-lg">No escalation rules yet.</p>
          <p className="text-body-md mt-xs">
            Create your first rule to start automating governance.
          </p>
        </div>
      ) : (
        <div className="space-y-sm">
          {rules.map((rule) => (
            <div
              key={rule.id}
              className={cn(
                "bg-surface-container-lowest rounded-xl border p-lg shadow-level-1 transition-opacity",
                rule.is_active ? "border-outline-variant" : "border-outline-variant/50 opacity-60",
              )}
            >
              <div className="flex items-start justify-between gap-md">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-sm flex-wrap">
                    <span className="text-title-sm font-semibold text-on-surface">
                      {rule.name}
                    </span>
                  </div>
                  <p className="text-body-sm text-on-surface-variant mt-xs">
                    {TRIGGER_LABELS[rule.trigger_condition]} — fires after{" "}
                    <strong className="text-on-surface">{rule.threshold_days}d</strong>
                  </p>
                  {/* Chain preview */}
                  <div className="flex items-center gap-xs mt-sm flex-wrap">
                    {rule.escalation_chain.map((step, i) => (
                      <div key={i} className="flex items-center gap-xs">
                        <span
                          className={cn(
                            "flex items-center gap-xs text-label-sm px-sm py-[2px] rounded-full",
                            TARGET_COLORS[step.target],
                          )}
                        >
                          <span className="material-symbols-outlined text-[14px]">
                            {TARGET_ICONS[step.target]}
                          </span>
                          {TARGET_LABELS[step.target]}
                          {step.delay_days > 0 && (
                            <span className="opacity-70">+{step.delay_days}d</span>
                          )}
                        </span>
                        {i < rule.escalation_chain.length - 1 && (
                          <span className="material-symbols-outlined text-[16px] text-outline-variant">
                            arrow_forward
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-xs shrink-0">
                  <button
                    onClick={() => toggleActive(rule)}
                    title={rule.is_active ? "Deactivate rule" : "Activate rule"}
                    disabled={updateRule.isPending}
                    className={cn(
                      "flex items-center gap-xs px-sm py-xs rounded-lg text-label-sm font-medium transition-colors disabled:opacity-50",
                      rule.is_active
                        ? "bg-tertiary-container/30 text-tertiary hover:bg-error-container/20 hover:text-on-error-container"
                        : "bg-surface-container-high text-on-surface-variant hover:bg-tertiary-container/30 hover:text-tertiary",
                    )}
                  >
                    <span className="material-symbols-outlined text-[16px]">
                      {rule.is_active ? "toggle_on" : "toggle_off"}
                    </span>
                    {rule.is_active ? "Active" : "Inactive"}
                  </button>
                  <button
                    onClick={() => openEdit(rule)}
                    className="p-sm rounded-lg text-on-surface-variant hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                  <button
                    onClick={() => setDeleteTarget(rule)}
                    className="p-sm rounded-lg text-on-surface-variant hover:bg-error-container/30 hover:text-on-error-container transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">delete</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <RuleFormDialog open={showForm} onClose={closeForm} existing={editRule} />

      <ConfirmDeleteDialog
        open={Boolean(deleteTarget)}
        ruleName={deleteTarget?.name ?? ""}
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
        isPending={deleteRule.isPending}
      />
    </>
  );
}

// ─── Logs Tab ─────────────────────────────────────────────────────────────────

const LEVEL_LABELS = ["Self", "Manager", "HR"];
const LEVEL_COLORS = [
  "bg-tertiary-container/30 text-tertiary",
  "bg-secondary-container/40 text-on-secondary-container",
  "bg-error-container/30 text-on-error-container",
];

function LogsTab() {
  const { data: rules = [] } = useEscalationRules();
  const [filterStatus, setFilterStatus] = useState<"" | "open" | "resolved">("");
  const [filterRule, setFilterRule] = useState<string>("");

  const { data: logs = [], isLoading } = useEscalationLogs({
    status: filterStatus || undefined,
    rule_id: filterRule || undefined,
  });

  const ruleMap = Object.fromEntries(rules.map((r) => [r.id, r.name]));

  function fmt(iso: string | null) {
    if (!iso) return "—";
    try {
      return format(parseISO(iso), "dd MMM yyyy, HH:mm");
    } catch {
      return iso;
    }
  }

  return (
    <>
      {/* Filters */}
      <div className="flex items-center gap-sm flex-wrap mb-lg">
        <select
          className="border border-outline-variant rounded-lg px-md py-sm text-body-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as "" | "open" | "resolved")}
        >
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="resolved">Resolved</option>
        </select>

        <select
          className="border border-outline-variant rounded-lg px-md py-sm text-body-sm bg-surface focus:outline-none focus:ring-2 focus:ring-primary min-w-[160px]"
          value={filterRule}
          onChange={(e) => setFilterRule(e.target.value)}
        >
          <option value="">All Rules</option>
          {rules.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {(filterStatus || filterRule) && (
          <button
            onClick={() => {
              setFilterStatus("");
              setFilterRule("");
            }}
            className="text-label-sm text-primary hover:underline flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-[14px]">close</span>
            Clear
          </button>
        )}

        <span className="ml-auto text-label-sm text-on-surface-variant">
          {logs.length} entries
        </span>
      </div>

      {isLoading ? (
        <div className="space-y-sm">
          {[1, 2, 3, 4].map((k) => (
            <div key={k} className="h-16 rounded-xl bg-surface-container-low animate-pulse" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-24 text-on-surface-variant">
          <span className="material-symbols-outlined text-[48px] mb-md block opacity-40">
            checklist
          </span>
          <p className="text-body-lg">No escalation events found.</p>
          {!filterStatus && !filterRule && (
            <p className="text-body-md mt-xs">
              Run the engine or wait for the hourly scheduler.
            </p>
          )}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="text-left px-lg py-sm text-label-sm text-on-surface-variant font-semibold">
                  Rule
                </th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-semibold">
                  Subject User
                </th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-semibold">
                  Level
                </th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-semibold">
                  Notified At
                </th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-semibold">
                  Status
                </th>
                <th className="text-left px-md py-sm text-label-sm text-on-surface-variant font-semibold">
                  Resolved At
                </th>
              </tr>
            </thead>
            <tbody>
              {logs.map((log) => (
                <tr
                  key={log.id}
                  className="border-b border-outline-variant/50 last:border-0 hover:bg-surface-container-low/50 transition-colors"
                >
                  <td className="px-lg py-sm font-medium text-on-surface">
                    {ruleMap[log.rule_id] ?? log.rule_id.slice(0, 8) + "…"}
                  </td>
                  <td className="px-md py-sm text-on-surface">
                    <div className="text-body-sm font-medium">
                      {log.context_data?.subject_user_name ?? log.subject_user_id.slice(0, 8) + "…"}
                    </div>
                    {(log.context_data?.manager_name ?? log.context_data?.employee_name) && (
                      <div className="text-label-sm text-on-surface-variant">
                        ({log.context_data.manager_name ?? log.context_data.employee_name})
                      </div>
                    )}
                  </td>
                  <td className="px-md py-sm">
                    <span
                      className={cn(
                        "text-label-sm px-sm py-[2px] rounded-full font-medium",
                        LEVEL_COLORS[log.chain_level] ?? LEVEL_COLORS[2],
                      )}
                    >
                      {LEVEL_LABELS[log.chain_level] ?? `L${log.chain_level}`}
                    </span>
                  </td>
                  <td className="px-md py-sm text-on-surface-variant">
                    {fmt(log.notified_at)}
                  </td>
                  <td className="px-md py-sm">
                    <span
                      className={cn(
                        "text-label-sm px-sm py-[2px] rounded-full font-medium",
                        log.status === "resolved"
                          ? "bg-tertiary-container/30 text-tertiary"
                          : "bg-error-container/30 text-on-error-container",
                      )}
                    >
                      {log.status === "resolved" ? "Resolved" : "Open"}
                    </span>
                  </td>
                  <td className="px-md py-sm text-on-surface-variant">
                    {fmt(log.resolved_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

type Tab = "rules" | "logs";

export default function EscalationPage() {
  const [tab, setTab] = useState<Tab>("rules");
  const runNow = useEscalationRunNow();

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-md flex-wrap">
        <div>
          <h2 className="text-headline-lg-mobile md:text-headline-lg text-on-surface">
            Escalation Module
          </h2>
          <p className="text-body-lg text-on-surface-variant mt-xs">
            Automated governance — configure rules that detect inaction and
            progressively notify the right people.
          </p>
        </div>
        <button
          onClick={() => runNow.mutate()}
          disabled={runNow.isPending}
          className="flex items-center gap-sm bg-primary text-on-primary px-lg py-sm rounded-xl text-label-md font-medium hover:opacity-90 transition-opacity disabled:opacity-50 shrink-0"
        >
          <span className="material-symbols-outlined text-[18px]">play_arrow</span>
          {runNow.isPending ? "Running…" : "Run Now"}
        </button>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-md">
        {[
          {
            icon: "flag",
            label: "Goals Not Submitted",
            desc: "Employee hasn't filed goal sheet within N days of cycle open",
            color: "text-error",
            bg: "bg-error-container/20",
          },
          {
            icon: "hourglass_empty",
            label: "Manager Approval Overdue",
            desc: "Manager hasn't approved submitted sheet within N days",
            color: "text-tertiary",
            bg: "bg-tertiary-container/20",
          },
          {
            icon: "event_busy",
            label: "Check-in Not Completed",
            desc: "Manager hasn't conducted quarterly check-in within window",
            color: "text-secondary",
            bg: "bg-secondary-container/30",
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-container-lowest border border-outline-variant rounded-xl p-lg shadow-level-1 flex gap-md items-start"
          >
            <div
              className={cn(
                "w-9 h-9 rounded-full flex items-center justify-center shrink-0",
                card.bg,
              )}
            >
              <span className={cn("material-symbols-outlined text-[20px]", card.color)}>
                {card.icon}
              </span>
            </div>
            <div>
              <p className="text-label-md font-semibold text-on-surface">{card.label}</p>
              <p className="text-body-sm text-on-surface-variant mt-xs">{card.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-level-1">
        <div className="flex border-b border-outline-variant px-lg">
          {(["rules", "logs"] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={cn(
                "px-lg py-md text-label-md font-medium border-b-2 -mb-px transition-colors",
                tab === t
                  ? "border-primary text-primary"
                  : "border-transparent text-on-surface-variant hover:text-on-surface",
              )}
            >
              {t === "rules" ? "Rules" : "Activity Log"}
            </button>
          ))}
        </div>

        <div className="p-lg">
          {tab === "rules" ? <RulesTab /> : <LogsTab />}
        </div>
      </div>
    </div>
  );
}
