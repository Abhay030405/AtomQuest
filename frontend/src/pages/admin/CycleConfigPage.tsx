import { useState } from "react";
import { parseISO, format, differenceInDays } from "date-fns";
import {
  useCycleConfigs,
  useUpdateCycleConfig,
  useActivateCycleWindow,
  useCreateCycleConfig,
} from "@/hooks/useAdmin";
import type { CycleConfig } from "@/types/cycle.types";
import { CyclePhase } from "@/types/cycle.types";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PHASE_OPTIONS: CyclePhase[] = [
  CyclePhase.GOAL_SETTING,
  CyclePhase.Q1,
  CyclePhase.Q2,
  CyclePhase.Q3,
  CyclePhase.Q4,
];

const PHASE_LABELS: Record<CyclePhase, string> = {
  [CyclePhase.GOAL_SETTING]: "Goal Setting",
  [CyclePhase.Q1]: "Q1 Check-in",
  [CyclePhase.Q2]: "Q2 Check-in",
  [CyclePhase.Q3]: "Q3 Check-in",
  [CyclePhase.Q4]: "Q4 / Annual Review",
};

function getDaysRemaining(cycle: CycleConfig): string {
  if (!cycle.isActive) return "";
  try {
    const days = differenceInDays(parseISO(cycle.windowClose), new Date());
    if (days < 0) return "Window closed";
    if (days === 0) return "Closes today";
    return `${days}d remaining`;
  } catch { return ""; }
}

export default function CycleConfigPage() {
  const { data: cycles = [], isLoading } = useCycleConfigs();
  const updateCycle = useUpdateCycleConfig();
  const activateCycle = useActivateCycleWindow();
  const createCycle = useCreateCycleConfig();

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ windowOpen: "", windowClose: "" });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({
    cycleName: "",
    phase: CyclePhase.GOAL_SETTING as CyclePhase,
    windowOpen: "",
    windowClose: "",
  });
  const [addError, setAddError] = useState<string | null>(null);

  function resetAddForm() {
    setAddForm({
      cycleName: "",
      phase: CyclePhase.GOAL_SETTING,
      windowOpen: "",
      windowClose: "",
    });
    setAddError(null);
  }

  function startEdit(cycle: CycleConfig) {
    setEditingId(cycle.id);
    setEditForm({
      windowOpen: cycle.windowOpen.slice(0, 10),
      windowClose: cycle.windowClose.slice(0, 10),
    });
  }

  function saveEdit(cycle: CycleConfig) {
    updateCycle.mutate({
      id: cycle.id,
      patch: {
        windowOpen: editForm.windowOpen + "T00:00:00.000Z",
        windowClose: editForm.windowClose + "T23:59:59.000Z",
      },
    });
    setEditingId(null);
  }

  function handleActivate(cycle: CycleConfig) {
    activateCycle.mutate({
      cycleId: cycle.id,
      windowOpen: cycle.windowOpen,
      windowClose: cycle.windowClose,
    });
  }

  function handleCreate() {
    setAddError(null);
    if (!addForm.cycleName.trim() || addForm.cycleName.trim().length < 3) {
      setAddError("Cycle name must be at least 3 characters");
      return;
    }
    if (!addForm.windowOpen || !addForm.windowClose) {
      setAddError("Window open and close dates are required");
      return;
    }
    if (addForm.windowOpen >= addForm.windowClose) {
      setAddError("Window open must be before window close");
      return;
    }
    createCycle.mutate(
      {
        cycleName: addForm.cycleName.trim(),
        phase: addForm.phase,
        windowOpen: addForm.windowOpen + "T00:00:00.000Z",
        windowClose: addForm.windowClose + "T23:59:59.000Z",
      },
      {
        onSuccess: () => {
          setShowAdd(false);
          resetAddForm();
        },
      },
    );
  }

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="mb-xl flex flex-col md:flex-row md:items-end justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <h2 className="text-headline-lg text-on-surface">Cycle &amp; Governance Configuration</h2>
          <p className="text-body-md text-on-surface-variant mt-xs">Manage active performance cycles, configure timelines, and oversee organizational objectives.</p>
        </div>
        <div className="flex gap-md">
          <button className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg shadow-level-1 hover:bg-surface-container-low transition-colors flex items-center gap-xs">
            <span className="material-symbols-outlined text-[18px]">download</span>
            Export Governance Report
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="bg-primary text-on-primary text-label-md px-md py-sm rounded-lg shadow-level-1 hover:opacity-90 transition-colors border-t border-white/20 flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-[18px]">add</span>
            New Cycle
          </button>
        </div>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 gap-lg">
        {/* Active Cycles */}
        <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 flex flex-col">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-bright rounded-t-xl">
            <h3 className="text-title-md text-on-surface flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">calendar_month</span>
              Active Goal Cycles
            </h3>
          </div>
          <div className="p-lg flex-1 overflow-x-auto">
            {isLoading ? (
              <div className="space-y-sm">
                {[1, 2, 3].map((i) => <div key={i} className="h-14 bg-surface-container-low rounded-lg animate-pulse" />)}
              </div>
            ) : (
              <table className="w-full text-left border-collapse min-w-[500px]">
                <thead>
                  <tr className="bg-surface-container-low border-y border-outline-variant">
                    <th className="py-sm px-md text-label-md text-on-surface-variant uppercase tracking-wider">Cycle Name</th>
                    <th className="py-sm px-md text-label-md text-on-surface-variant uppercase tracking-wider">Status</th>
                    <th className="py-sm px-md text-label-md text-on-surface-variant uppercase tracking-wider">Window Open</th>
                    <th className="py-sm px-md text-label-md text-on-surface-variant uppercase tracking-wider">Window Close</th>
                    <th className="py-sm px-md text-label-md text-on-surface-variant uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="text-body-md divide-y divide-outline-variant">
                  {cycles.map((cycle) => {
                    const isEditing = editingId === cycle.id;
                    const daysLeft = getDaysRemaining(cycle);
                    return (
                      <tr key={cycle.id} className="hover:bg-surface-bright transition-colors group">
                        <td className="py-md px-md font-medium text-on-surface">{cycle.cycleName}</td>
                        <td className="py-md px-md">
                          {cycle.isActive ? (
                            <span className="inline-flex items-center gap-xs px-2 py-1 rounded-full bg-tertiary-fixed text-on-tertiary-fixed-variant text-label-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-tertiary"></span>
                              Active
                              {daysLeft && <span className="text-on-surface-variant"> · {daysLeft}</span>}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-xs px-2 py-1 rounded-full bg-surface-container-highest text-on-surface-variant text-label-md">
                              <span className="w-1.5 h-1.5 rounded-full bg-outline"></span>
                              Inactive
                            </span>
                          )}
                        </td>
                        <td className="py-md px-md text-on-surface-variant">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.windowOpen}
                              onChange={(e) => setEditForm((f) => ({ ...f, windowOpen: e.target.value }))}
                              className="bg-surface-container-lowest border border-outline-variant rounded px-sm py-xs text-body-md focus:border-primary focus:outline-none w-36"
                            />
                          ) : (
                            format(parseISO(cycle.windowOpen), "MMM d, yyyy")
                          )}
                        </td>
                        <td className="py-md px-md text-on-surface-variant">
                          {isEditing ? (
                            <input
                              type="date"
                              value={editForm.windowClose}
                              onChange={(e) => setEditForm((f) => ({ ...f, windowClose: e.target.value }))}
                              className="bg-surface-container-lowest border border-outline-variant rounded px-sm py-xs text-body-md focus:border-primary focus:outline-none w-36"
                            />
                          ) : (
                            format(parseISO(cycle.windowClose), "MMM d, yyyy")
                          )}
                        </td>
                        <td className="py-md px-md text-right">
                          {isEditing ? (
                            <div className="flex items-center justify-end gap-sm">
                              <button
                                onClick={() => saveEdit(cycle)}
                                disabled={updateCycle.isPending}
                                className="text-tertiary hover:text-tertiary-container text-label-md font-medium transition-colors"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="text-on-surface-variant hover:text-on-surface text-label-md transition-colors"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-sm">
                              <button
                                onClick={() => startEdit(cycle)}
                                className="text-primary hover:text-primary-container text-label-md opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                Edit Timeline
                              </button>
                              {!cycle.isActive && (
                                <button
                                  onClick={() => handleActivate(cycle)}
                                  disabled={activateCycle.isPending}
                                  className="text-on-surface-variant hover:text-primary text-label-md opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  Activate
                                </button>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                  {cycles.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-lg px-md text-center text-on-surface-variant text-body-md">
                        No cycles configured yet. Click <span className="font-medium">New Cycle</span> to create one.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Add cycle dialog */}
      <Dialog
        open={showAdd}
        onOpenChange={(v) => {
          if (!v) {
            setShowAdd(false);
            resetAddForm();
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-title-lg text-on-surface">New Cycle Configuration</DialogTitle>
          </DialogHeader>
          <div className="py-md space-y-md">
            <label className="flex flex-col gap-xs">
              <span className="text-label-md text-on-surface">Cycle Name</span>
              <input
                type="text"
                value={addForm.cycleName}
                onChange={(e) => setAddForm((f) => ({ ...f, cycleName: e.target.value }))}
                placeholder="e.g. FY2026 Goal Setting"
                className="w-full p-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface"
              />
            </label>
            <label className="flex flex-col gap-xs">
              <span className="text-label-md text-on-surface">Phase</span>
              <select
                value={addForm.phase}
                onChange={(e) => setAddForm((f) => ({ ...f, phase: e.target.value as CyclePhase }))}
                className="w-full p-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface"
              >
                {PHASE_OPTIONS.map((p) => (
                  <option key={p} value={p}>{PHASE_LABELS[p]}</option>
                ))}
              </select>
            </label>
            <div className="grid grid-cols-2 gap-md">
              <label className="flex flex-col gap-xs">
                <span className="text-label-md text-on-surface">Window Open</span>
                <input
                  type="date"
                  value={addForm.windowOpen}
                  onChange={(e) => setAddForm((f) => ({ ...f, windowOpen: e.target.value }))}
                  className="w-full p-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface"
                />
              </label>
              <label className="flex flex-col gap-xs">
                <span className="text-label-md text-on-surface">Window Close</span>
                <input
                  type="date"
                  value={addForm.windowClose}
                  onChange={(e) => setAddForm((f) => ({ ...f, windowClose: e.target.value }))}
                  className="w-full p-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface"
                />
              </label>
            </div>
            {addError && (
              <p className="text-body-sm text-error">{addError}</p>
            )}
          </div>
          <DialogFooter className="flex gap-sm">
            <button
              onClick={() => {
                setShowAdd(false);
                resetAddForm();
              }}
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={createCycle.isPending}
              className="bg-primary text-on-primary text-label-md px-md py-sm rounded-lg shadow-level-1 hover:opacity-90 transition-colors disabled:opacity-50"
            >
              {createCycle.isPending ? "Creating…" : "Create Cycle"}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
