import { useState } from "react";
import { parseISO, format, differenceInDays } from "date-fns";
import { useCycleConfigs, useUpdateCycleConfig, useActivateCycleWindow } from "@/hooks/useAdmin";
import { CyclePhase } from "@/types/cycle.types";
import type { CycleConfig } from "@/types/cycle.types";
import { quarterLabel } from "@/utils/date.util";
import { cn } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

const PUSH_CYCLES = ["Q3 2024 Objectives", "Annual 2024 Strategic"];
const PUSH_AUDIENCES = ["All Departments", "Engineering Only", "Sales & Marketing"];

function getWindowLabel(cycle: CycleConfig): string {
  try {
    return `${format(parseISO(cycle.windowOpen), "MMM d")} – ${format(parseISO(cycle.windowClose), "MMM d, yyyy")}`;
  } catch { return "—"; }
}

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

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ windowOpen: "", windowClose: "" });
  const [showAdd, setShowAdd] = useState(false);

  const [unlockSearch, setUnlockSearch] = useState("");
  const [unlockReason, setUnlockReason] = useState("");
  const [pushCycle, setPushCycle] = useState(PUSH_CYCLES[0]);
  const [pushAudience, setPushAudience] = useState(PUSH_AUDIENCES[0]);

  const activeCycle = cycles.find((c) => c.isActive);

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
      <div className="grid grid-cols-1 md:grid-cols-12 gap-lg">
        {/* Active Cycles (8 cols) */}
        <div className="col-span-1 md:col-span-8 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 flex flex-col">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-bright rounded-t-xl">
            <h3 className="text-title-md text-on-surface flex items-center gap-xs">
              <span className="material-symbols-outlined text-primary">calendar_month</span>
              Active Goal Cycles
            </h3>
            <div className="flex gap-xs">
              <button className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">filter_list</span>
              </button>
              <button className="text-on-surface-variant hover:text-primary transition-colors">
                <span className="material-symbols-outlined">more_vert</span>
              </button>
            </div>
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
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Push Org Goals (4 cols) */}
        <div className="col-span-1 md:col-span-4 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-full pointer-events-none" />
          <div className="p-lg border-b border-outline-variant flex justify-between items-center relative z-10">
            <h3 className="text-title-md text-on-surface flex items-center gap-xs">
              <span className="material-symbols-outlined text-secondary">domain</span>
              Push Organization Goals
            </h3>
          </div>
          <div className="p-lg flex-1 flex flex-col gap-md relative z-10">
            <p className="text-body-md text-on-surface-variant">Assign top-down strategic objectives to departments or entire organizations.</p>
            <div className="flex flex-col gap-sm">
              <label className="text-label-md text-on-surface">Target Cycle</label>
              <select
                value={pushCycle}
                onChange={(e) => setPushCycle(e.target.value)}
                className="w-full p-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface"
              >
                {PUSH_CYCLES.map((c) => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-sm">
              <label className="text-label-md text-on-surface">Target Audience</label>
              <select
                value={pushAudience}
                onChange={(e) => setPushAudience(e.target.value)}
                className="w-full p-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface"
              >
                {PUSH_AUDIENCES.map((a) => <option key={a}>{a}</option>)}
              </select>
            </div>
            <button className="mt-auto bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg shadow-level-1 hover:bg-surface-container-low transition-colors flex items-center justify-center gap-xs w-full">
              <span className="material-symbols-outlined text-[18px]">publish</span>
              Configure Push Draft
            </button>
          </div>
        </div>

        {/* Exception Handling (12 cols) */}
        <div className="col-span-1 md:col-span-12 bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 flex flex-col">
          <div className="p-lg border-b border-outline-variant flex justify-between items-center bg-surface-bright rounded-t-xl">
            <h3 className="text-title-md text-error flex items-center gap-xs">
              <span className="material-symbols-outlined">lock_open_right</span>
              Exception Handling: Unlock Goals
            </h3>
          </div>
          <div className="p-lg grid grid-cols-1 md:grid-cols-3 gap-lg items-end">
            <div className="col-span-1 md:col-span-2">
              <p className="text-body-md text-on-surface-variant mb-md">Locate specific employees to unlock their approved goals for mid-cycle revisions. An audit reason is required.</p>
              <div className="flex gap-md flex-col md:flex-row">
                <div className="flex-1">
                  <label className="block text-label-md text-on-surface mb-xs">Employee Search</label>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">search</span>
                    <input
                      type="text"
                      value={unlockSearch}
                      onChange={(e) => setUnlockSearch(e.target.value)}
                      placeholder="Search by name or ID..."
                      className="w-full pl-xl pr-sm py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface transition-all"
                    />
                  </div>
                </div>
                <div className="flex-1">
                  <label className="block text-label-md text-on-surface mb-xs">Reason for Unlock (Audit Log)</label>
                  <input
                    type="text"
                    value={unlockReason}
                    onChange={(e) => setUnlockReason(e.target.value)}
                    placeholder="e.g., Role change, shift in strategy..."
                    className="w-full px-sm py-sm rounded-lg border border-outline-variant bg-surface-container-lowest focus:border-primary focus:ring-2 focus:ring-primary/15 outline-none text-body-md text-on-surface transition-all"
                  />
                </div>
              </div>
            </div>
            <div className="col-span-1 flex justify-end">
              <button
                disabled={!unlockSearch.trim() || !unlockReason.trim()}
                className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-lg py-sm rounded-lg shadow-level-1 hover:bg-surface-container-low transition-colors flex items-center gap-xs h-[40px] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="material-symbols-outlined text-[18px]">key</span>
                Unlock Record
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Add cycle dialog */}
      <Dialog open={showAdd} onOpenChange={(v) => !v && setShowAdd(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-title-lg text-on-surface">Add Cycle Configuration</DialogTitle>
          </DialogHeader>
          <div className="py-md text-center">
            <p className="text-body-md text-on-surface-variant">
              New cycle creation is managed by the backend configuration team. Contact your system administrator.
            </p>
          </div>
          <DialogFooter>
            <button
              onClick={() => setShowAdd(false)}
              className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg hover:bg-surface-container-low transition-colors"
            >
              Close
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
