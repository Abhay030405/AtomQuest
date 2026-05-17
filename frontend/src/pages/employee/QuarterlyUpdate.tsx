import { useState } from "react";
import { useMyGoals } from "@/hooks/useGoals";
import { useCycleStore } from "@/store/cycleStore";

const STATUS_OPTIONS = ["Not Started", "On Track", "Behind", "Completed"];

export default function QuarterlyUpdate() {
  const { activeWindow } = useCycleStore();
  const cycleName = activeWindow?.cycleName ?? "Current Quarter";
  const { data: goals = [], isLoading } = useMyGoals(activeWindow?.id);

  const approvedGoals = goals.filter((g) => g.status === "approved" || g.status === "locked");
  const onTrack = approvedGoals.filter((g) => ((g as any).currentValue ?? 0) >= 60).length;

  const [actuals, setActuals] = useState<Record<string, string>>({});
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  const totalProgress =
    approvedGoals.length > 0
      ? Math.round(approvedGoals.reduce((sum, g) => sum + ((g as any).currentValue ?? 0), 0) / approvedGoals.length)
      : 0;

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <h1 className="text-headline-lg-mobile md:text-headline-lg text-on-surface">Quarterly Progress Update</h1>
          <p className="text-body-md text-on-surface-variant mt-xs">Update your actuals and status for locked goals.</p>
        </div>
        <select className="bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-md py-2 shadow-level-1">
          <option>{cycleName}</option>
        </select>
      </div>

      {/* Summary bento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-primary">donut_large</span>
            <h2 className="text-title-md">Overall Completion</h2>
          </div>
          <div className="flex items-end gap-sm">
            <span className="text-display-lg text-on-surface">{totalProgress}%</span>
          </div>
          <div className="w-full bg-surface-container-high rounded-full h-2 mt-sm">
            <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-tertiary">check_circle</span>
            <h2 className="text-title-md">Goals on Track</h2>
          </div>
          <div className="flex items-end gap-sm">
            <span className="text-display-lg text-on-surface">{onTrack}/{approvedGoals.length}</span>
            <span className="text-body-md text-on-surface-variant mb-2">Active Goals</span>
          </div>
        </div>

        <div className="bg-surface-container-lowest rounded-xl p-lg border border-outline-variant shadow-level-1">
          <div className="flex items-center gap-sm text-on-surface-variant mb-xs">
            <span className="material-symbols-outlined text-secondary">calendar_month</span>
            <h2 className="text-title-md">Active Cycle</h2>
          </div>
          <div className="flex items-end gap-sm">
            <span className="text-title-lg text-on-surface">{cycleName}</span>
          </div>
        </div>
      </div>

      {/* Goal list + sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
        {/* Goals column */}
        <div className="lg:col-span-2 space-y-md">
          <h2 className="text-title-lg text-on-surface mb-sm">Approved Goals</h2>

          {isLoading ? (
            <div className="space-y-md">
              {[1, 2].map((i) => (
                <div key={i} className="bg-surface-container-lowest rounded-xl border border-outline-variant h-40 animate-pulse" />
              ))}
            </div>
          ) : approvedGoals.length === 0 ? (
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">lock</span>
              <p className="text-body-lg text-on-surface-variant mt-md">No approved goals to update yet.</p>
            </div>
          ) : (
            approvedGoals.map((goal) => (
              <div key={goal.id} className="bg-surface-container-lowest rounded-xl border border-outline-variant shadow-level-1 overflow-hidden">
                <div className="p-md border-b border-outline-variant bg-surface-container-low flex justify-between items-start">
                  <div>
                    <div className="flex items-center gap-xs mb-xs">
                      <span className="material-symbols-outlined text-secondary text-[16px]">lock</span>
                      <span className="text-label-md text-secondary uppercase">{(goal as any).uom ?? "Goal"}</span>
                    </div>
                    <h3 className="text-title-lg text-on-surface">{goal.title}</h3>
                    <p className="text-body-md text-on-surface-variant mt-xs line-clamp-2">{goal.description}</p>
                  </div>
                  <span className="inline-flex items-center px-2 py-1 rounded text-label-md bg-tertiary-container text-on-tertiary-container shrink-0">
                    {statuses[goal.id] ?? "On Track"}
                  </span>
                </div>

                <div className="p-md grid grid-cols-1 md:grid-cols-2 gap-md">
                  <div>
                    <label className="text-label-md text-on-surface-variant block mb-xs">Status</label>
                    <select
                      value={statuses[goal.id] ?? "On Track"}
                      onChange={(e) => setStatuses((s) => ({ ...s, [goal.id]: e.target.value }))}
                      className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-sm py-2"
                    >
                      {STATUS_OPTIONS.map((o) => <option key={o}>{o}</option>)}
                    </select>
                  </div>
                  <div className="flex gap-sm">
                    <div className="flex-1">
                      <label className="text-label-md text-on-surface-variant block mb-xs">Target</label>
                      <div className="w-full bg-surface-container-high border border-outline-variant text-on-surface-variant text-body-md rounded-lg px-sm py-2 cursor-not-allowed">
                        {goal.targetValue ?? "—"}
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-label-md text-on-surface-variant block mb-xs">Actual</label>
                      <input
                        type="text"
                        value={actuals[goal.id] ?? String((goal as any).currentValue ?? "")}
                        onChange={(e) => setActuals((a) => ({ ...a, [goal.id]: e.target.value }))}
                        className="w-full bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-lg focus:ring-2 focus:ring-primary focus:border-primary px-sm py-2"
                      />
                    </div>
                  </div>
                </div>

                <div className="px-md pb-md">
                  <div className="flex justify-between text-label-md text-on-surface-variant mb-xs">
                    <span>Progress</span>
                    <span>{(goal as any).currentValue ?? 0}%</span>
                  </div>
                  <div className="w-full bg-surface-container-high rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{ width: `${Math.min((goal as any).currentValue ?? 0, 100)}%` }} />
                  </div>
                </div>

                {(goal as any).managerComment && (
                  <div className="px-md pb-md pt-sm border-t border-outline-variant bg-surface-bright">
                    <h4 className="text-label-md text-on-surface-variant mb-sm uppercase">Manager Feedback</h4>
                    <div className="flex gap-sm">
                      <div className="w-8 h-8 rounded-full bg-secondary-container text-on-secondary-container flex items-center justify-center font-bold text-sm shrink-0">
                        M
                      </div>
                      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-sm w-full">
                        <p className="text-body-md text-on-surface">"{(goal as any).managerComment}"</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-md">
          {/* Actions card */}
          <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1 flex flex-col gap-sm">
            <button className="w-full bg-primary text-on-primary text-title-md rounded-lg py-2 px-md hover:opacity-90 transition-all border-t border-white/20 shadow-level-1 flex items-center justify-center gap-xs">
              <span className="material-symbols-outlined text-[20px]">send</span>
              Submit for Review
            </button>
            <button className="w-full bg-surface-container text-on-surface text-title-md rounded-lg py-2 px-md hover:bg-surface-container-high border border-outline-variant shadow-level-1 flex items-center justify-center gap-xs">
              <span className="material-symbols-outlined text-[20px]">save</span>
              Save Draft
            </button>
            <p className="text-label-md text-on-surface-variant text-center mt-xs">Progress auto-saved</p>
          </div>

          {/* Trend placeholder */}
          <div className="bg-surface-container-lowest rounded-xl p-md border border-outline-variant shadow-level-1">
            <h2 className="text-title-md text-on-surface mb-sm flex items-center gap-xs">
              <span className="material-symbols-outlined text-secondary text-[20px]">insights</span>
              Performance Trends
            </h2>
            <div className="h-48 bg-surface-container-low rounded border border-outline-variant flex items-center justify-center">
              <span className="text-body-md text-on-surface-variant">Chart coming soon</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
