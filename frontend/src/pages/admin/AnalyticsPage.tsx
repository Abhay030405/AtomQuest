import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useCycleStore } from "@/store/cycleStore";
import { analyticsService } from "@/services/analytics.service";
import type { ManagerEffectivenessRow, HeatmapCell } from "@/services/analytics.service";
import { adminService } from "@/services/admin.service";
import { CyclePhase } from "@/types/cycle.types";

// ─── Colour palette ───────────────────────────────────────────────────────────

const PALETTE = ["#6750A4", "#7965AF", "#58B8B8", "#B5C0FF", "#D0BCFF", "#CCC2DC", "#EFB8C8"];
const QUARTER_LABELS: Record<string, string> = { q1: "Q1", q2: "Q2", q3: "Q3", q4: "Q4" };

function pctToColor(pct: number): string {
  if (pct >= 80) return "bg-green-500/80";
  if (pct >= 50) return "bg-amber-400/80";
  return "bg-red-500/80";
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg shadow-level-1 flex flex-col gap-xs">
      <span className="text-label-md text-on-surface-variant uppercase tracking-wider">{label}</span>
      <span className="text-display-sm text-on-surface font-bold">{value}</span>
      {sub && <span className="text-body-sm text-on-surface-variant">{sub}</span>}
    </div>
  );
}

function SectionHeader({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="mb-lg">
      <h3 className="text-title-lg text-on-surface font-semibold">{title}</h3>
      <p className="text-body-md text-on-surface-variant mt-xs">{desc}</p>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-md animate-pulse">
      <div className="h-8 bg-surface-container-low rounded w-64" />
      <div className="h-64 bg-surface-container-low rounded-xl" />
    </div>
  );
}

// ─── Tab 1 — QoQ Trend ────────────────────────────────────────────────────────

function QoQTrendTab({ cycleId }: { cycleId: string }) {
  const [scope, setScope] = useState<"org" | "department" | "manager" | "user">("org");

  const { data = [], isLoading } = useQuery({
    queryKey: ["qoq-trend", cycleId, scope],
    queryFn: () => analyticsService.getQoQTrend({ cycleId, scope }),
    enabled: Boolean(cycleId),
  });

  const chartData = data.map((d) => ({
    name: QUARTER_LABELS[d.quarter] ?? d.quarter.toUpperCase(),
    score: d.avg_score,
    employees: d.total_employees,
  }));

  const latestScore = data.length > 0 ? data[data.length - 1].avg_score : null;
  const firstScore = data.length > 0 ? data[0].avg_score : null;
  const trend =
    latestScore != null && firstScore != null ? latestScore - firstScore : null;

  return (
    <div className="space-y-lg">
      <SectionHeader
        title="Quarter-on-Quarter Achievement Trends"
        desc="Track how weighted scores evolve across Q1–Q4. Switch scope to zoom in from org-wide down to a single manager's team."
      />

      {/* Scope toggle */}
      <div className="flex gap-sm flex-wrap">
        {(["org", "department", "manager", "user"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setScope(s)}
            className={cn(
              "px-md py-sm rounded-full text-label-md font-medium border transition-colors",
              scope === s
                ? "bg-primary text-on-primary border-primary"
                : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
            )}
          >
            {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-md">
        <StatCard label="Quarters Tracked" value={data.length} />
        <StatCard
          label="Latest Avg Score"
          value={latestScore != null ? `${latestScore}%` : "—"}
        />
        <StatCard
          label="Trend"
          value={
            trend != null
              ? `${trend > 0 ? "+" : ""}${trend.toFixed(1)}%`
              : "—"
          }
          sub={trend != null ? (trend >= 0 ? "Improving" : "Declining") : undefined}
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : data.length === 0 ? (
        <div className="rounded-xl border border-outline-variant p-xl text-center text-on-surface-variant">
          No snapshot data available for this scope and cycle.
        </div>
      ) : (
        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={chartData} margin={{ top: 8, right: 24, bottom: 8, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
              <XAxis dataKey="name" tick={{ fill: "var(--color-on-surface-variant)", fontSize: 12 }} />
              <YAxis
                domain={[0, 100]}
                tick={{ fill: "var(--color-on-surface-variant)", fontSize: 12 }}
                tickFormatter={(v) => `${v}%`}
              />
              <Tooltip formatter={(v) => [`${v ?? ""}%`, "Avg Score"]} />
              <Legend />
              <Line
                type="monotone"
                dataKey="score"
                name="Avg Weighted Score"
                stroke="#6750A4"
                strokeWidth={2}
                dot={{ r: 5, fill: "#6750A4" }}
                activeDot={{ r: 7 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

// ─── Tab 2 — Completion Heatmap ───────────────────────────────────────────────

const QUARTERS = ["q1", "q2", "q3", "q4"] as const;

function HeatmapTab({ cycleId }: { cycleId: string }) {
  const [mode, setMode] = useState<"achievement" | "checkin">("achievement");
  const [drillDept, setDrillDept] = useState<string | null>(null);

  const { data: cells = [], isLoading } = useQuery({
    queryKey: ["completion-heatmap", cycleId],
    queryFn: () => analyticsService.getCompletionHeatmap(cycleId),
    enabled: Boolean(cycleId),
  });

  // Build dept × quarter grid
  const depts = Array.from(new Set(cells.map((c) => c.department_name))).sort();

  function getCell(dept: string, q: string): HeatmapCell | undefined {
    return cells.find((c) => c.department_name === dept && c.quarter === q);
  }

  function pct(cell: HeatmapCell | undefined): number | null {
    if (!cell) return null;
    return mode === "achievement" ? cell.achievement_pct : cell.checkin_pct;
  }

  const drillRows = drillDept
    ? cells.filter((c) => c.department_name === drillDept)
    : [];

  return (
    <div className="space-y-lg">
      <SectionHeader
        title="Completion Rate Heatmap"
        desc="Each cell shows what % of employees in a department completed achievements or received check-ins that quarter. Click a cell to drill down."
      />

      {/* Mode toggle */}
      <div className="flex gap-sm">
        <button
          onClick={() => setMode("achievement")}
          className={cn(
            "px-md py-sm rounded-full text-label-md font-medium border transition-colors",
            mode === "achievement"
              ? "bg-primary text-on-primary border-primary"
              : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
          )}
        >
          Achievement Submission
        </button>
        <button
          onClick={() => setMode("checkin")}
          className={cn(
            "px-md py-sm rounded-full text-label-md font-medium border transition-colors",
            mode === "checkin"
              ? "bg-primary text-on-primary border-primary"
              : "border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
          )}
        >
          Check-in Completion
        </button>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-md text-body-sm text-on-surface-variant">
        <span className="inline-flex items-center gap-xs">
          <span className="w-4 h-4 rounded bg-green-500/80" /> ≥80%
        </span>
        <span className="inline-flex items-center gap-xs">
          <span className="w-4 h-4 rounded bg-amber-400/80" /> 50–79%
        </span>
        <span className="inline-flex items-center gap-xs">
          <span className="w-4 h-4 rounded bg-red-500/80" /> &lt;50%
        </span>
        <span className="inline-flex items-center gap-xs">
          <span className="w-4 h-4 rounded bg-surface-container-high" /> No data
        </span>
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : depts.length === 0 ? (
        <div className="rounded-xl border border-outline-variant p-xl text-center text-on-surface-variant">
          No heatmap data for this cycle.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="text-left px-md py-sm text-on-surface-variant font-semibold">Department</th>
                {QUARTERS.map((q) => (
                  <th key={q} className="text-center px-md py-sm text-on-surface-variant font-semibold w-24">
                    {q.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {depts.map((dept, di) => (
                <tr
                  key={dept}
                  className={cn("border-b border-outline-variant/50", di % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low/30")}
                >
                  <td className="px-md py-sm font-medium text-on-surface">{dept}</td>
                  {QUARTERS.map((q) => {
                    const cell = getCell(dept, q);
                    const p = pct(cell);
                    return (
                      <td key={q} className="px-sm py-sm text-center">
                        <button
                          onClick={() => setDrillDept(drillDept === dept ? null : dept)}
                          disabled={!cell}
                          className={cn(
                            "w-full rounded-lg py-xs text-label-md font-semibold transition-all",
                            p != null ? pctToColor(p) : "bg-surface-container-high text-on-surface-variant/40",
                            p != null ? "text-white cursor-pointer hover:opacity-80" : "cursor-default"
                          )}
                        >
                          {p != null ? `${p.toFixed(0)}%` : "—"}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Drill-down panel */}
      {drillDept && drillRows.length > 0 && (
        <div className="rounded-xl border border-outline-variant bg-surface-container-low p-lg space-y-md">
          <div className="flex items-center justify-between">
            <h4 className="text-title-md font-semibold text-on-surface">{drillDept} — Detail</h4>
            <button
              onClick={() => setDrillDept(null)}
              className="text-on-surface-variant hover:text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined text-[20px]">close</span>
            </button>
          </div>
          <table className="w-full text-body-sm">
            <thead>
              <tr className="text-on-surface-variant text-left border-b border-outline-variant">
                <th className="py-xs pr-md">Quarter</th>
                <th className="py-xs pr-md">Employees</th>
                <th className="py-xs pr-md">Achievements Submitted</th>
                <th className="py-xs pr-md">Check-ins Done</th>
              </tr>
            </thead>
            <tbody>
              {drillRows.map((r) => (
                <tr key={r.quarter} className="border-b border-outline-variant/30">
                  <td className="py-xs pr-md font-medium">{r.quarter.toUpperCase()}</td>
                  <td className="py-xs pr-md">{r.total_employees}</td>
                  <td className="py-xs pr-md">
                    {r.achievement_submitted_count}/{r.total_employees}
                    <span className="ml-xs text-on-surface-variant">
                      ({r.achievement_pct.toFixed(0)}%)
                    </span>
                  </td>
                  <td className="py-xs pr-md">
                    {r.checkin_done_count}/{r.total_employees}
                    <span className="ml-xs text-on-surface-variant">
                      ({r.checkin_pct.toFixed(0)}%)
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Tab 3 — Goal Distribution ────────────────────────────────────────────────

const THRUST_LABELS: Record<string, string> = {
  revenue_growth: "Revenue Growth",
  customer_satisfaction: "Customer Satisfaction",
  operational_excellence: "Operational Excellence",
  people_development: "People Development",
  safety_compliance: "Safety & Compliance",
  innovation: "Innovation",
  cost_optimisation: "Cost Optimisation",
  quality: "Quality",
};

const UOM_LABELS: Record<string, string> = {
  min: "MIN (Lower is Better)",
  max: "MAX (Higher is Better)",
  timeline: "Timeline",
  zero: "Zero-Target",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  submitted: "Submitted",
  under_review: "Under Review",
  approved: "Approved",
  locked: "Locked",
  archived: "Archived",
};

function GoalDistributionTab({ cycleId }: { cycleId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["goal-distribution", cycleId],
    queryFn: () => analyticsService.getGoalDistribution(cycleId),
    enabled: Boolean(cycleId),
  });

  const thrustData = (data?.by_thrust_area ?? []).map((d) => ({
    name: THRUST_LABELS[d.label] ?? d.label,
    value: d.count,
  }));
  const uomData = (data?.by_uom_type ?? []).map((d) => ({
    name: UOM_LABELS[d.label] ?? d.label,
    value: d.count,
  }));
  const statusData = (data?.by_status ?? []).map((d) => ({
    name: STATUS_LABELS[d.label] ?? d.label,
    value: d.count,
  }));

  const totalGoals = thrustData.reduce((s, d) => s + d.value, 0);

  return (
    <div className="space-y-lg">
      <SectionHeader
        title="Goal Distribution Analysis"
        desc="Understand what your organization's goals are actually made of — by thrust area, measurement type, and approval status."
      />

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-md">
        <StatCard label="Total Goals" value={totalGoals} />
        <StatCard
          label="Top Thrust Area"
          value={thrustData[0] ? THRUST_LABELS[data?.by_thrust_area[0]?.label ?? ""] ?? thrustData[0].name : "—"}
        />
        <StatCard
          label="Top UoM Type"
          value={uomData[0] ? UOM_LABELS[data?.by_uom_type[0]?.label ?? ""] ?? uomData[0].name : "—"}
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : totalGoals === 0 ? (
        <div className="rounded-xl border border-outline-variant p-xl text-center text-on-surface-variant">
          No goal data for this cycle.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          {/* Thrust Area */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <h4 className="text-title-sm font-semibold text-on-surface mb-md">By Thrust Area</h4>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={thrustData}
                  cx="50%"
                  cy="50%"
                  outerRadius={80}
                  dataKey="value"
                  label={({ percent }) =>
                    `${((percent ?? 0) * 100).toFixed(0)}%`
                  }
                  labelLine={false}
                >
                  {thrustData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [v ?? 0, "Goals"]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-md space-y-xs">
              {thrustData.map((d, i) => (
                <div key={d.name} className="flex items-center justify-between text-body-sm">
                  <div className="flex items-center gap-xs">
                    <span
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PALETTE[i % PALETTE.length] }}
                    />
                    <span className="text-on-surface-variant truncate max-w-[140px]">{d.name}</span>
                  </div>
                  <span className="font-semibold text-on-surface">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* UoM Type */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <h4 className="text-title-sm font-semibold text-on-surface mb-md">By Measurement Type</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={uomData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v ?? 0, "Goals"]} />
                <Bar dataKey="value" name="Goals" radius={[0, 4, 4, 0]}>
                  {uomData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Status */}
          <div className="bg-surface-container-lowest rounded-xl border border-outline-variant p-lg">
            <h4 className="text-title-sm font-semibold text-on-surface mb-md">By Status</h4>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={statusData} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-outline-variant)" />
                <XAxis type="number" tick={{ fontSize: 11 }} />
                <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v) => [v ?? 0, "Goals"]} />
                <Bar dataKey="value" name="Goals" radius={[0, 4, 4, 0]}>
                  {statusData.map((_, i) => (
                    <Cell key={i} fill={PALETTE[i % PALETTE.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Tab 4 — Manager Effectiveness ───────────────────────────────────────────

type SortKey = "checkin_rate" | "avg_team_score" | "avg_turnaround_days" | "direct_reports";

function ManagerEffectivenessTab({ cycleId }: { cycleId: string }) {
  const [sortKey, setSortKey] = useState<SortKey>("checkin_rate");
  const [sortAsc, setSortAsc] = useState(true);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["manager-effectiveness", cycleId],
    queryFn: () => analyticsService.getManagerEffectiveness(cycleId),
    enabled: Boolean(cycleId),
  });

  const sorted = [...rows].sort((a, b) => {
    const av = a[sortKey] ?? (sortAsc ? Infinity : -Infinity);
    const bv = b[sortKey] ?? (sortAsc ? Infinity : -Infinity);
    return sortAsc ? (av as number) - (bv as number) : (bv as number) - (av as number);
  });

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortAsc((v) => !v);
    else { setSortKey(key); setSortAsc(true); }
  }

  function SortIcon({ k }: { k: SortKey }) {
    if (sortKey !== k) return <span className="material-symbols-outlined text-[14px] text-on-surface-variant/50">unfold_more</span>;
    return (
      <span className="material-symbols-outlined text-[14px] text-primary">
        {sortAsc ? "arrow_upward" : "arrow_downward"}
      </span>
    );
  }

  const avgCheckin =
    rows.length > 0
      ? (rows.reduce((s, r) => s + r.checkin_rate, 0) / rows.length).toFixed(1)
      : "—";

  const avgTurnaround = (() => {
    const valid = rows.filter((r) => r.avg_turnaround_days != null);
    if (valid.length === 0) return "—";
    return (valid.reduce((s, r) => s + r.avg_turnaround_days!, 0) / valid.length).toFixed(1);
  })();

  return (
    <div className="space-y-lg">
      <SectionHeader
        title="Manager Effectiveness Dashboard"
        desc="Per-manager view of team engagement: headcount, goal approval turnaround time, team score, and check-in completion rate. Sort any column."
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-md">
        <StatCard label="Managers Tracked" value={rows.length} />
        <StatCard label="Avg Checkin Rate" value={avgCheckin !== "—" ? `${avgCheckin}%` : "—"} />
        <StatCard label="Avg Turnaround" value={avgTurnaround !== "—" ? `${avgTurnaround}d` : "—"} sub="Days to approve" />
        <StatCard
          label="Lowest Checkin Rate"
          value={sorted.length > 0 ? `${sorted[0].checkin_rate.toFixed(1)}%` : "—"}
          sub={sorted[0]?.manager_name}
        />
      </div>

      {isLoading ? (
        <LoadingSkeleton />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-outline-variant p-xl text-center text-on-surface-variant">
          No manager data for this cycle.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-outline-variant">
          <table className="w-full text-body-sm">
            <thead>
              <tr className="border-b border-outline-variant bg-surface-container-low">
                <th className="text-left px-md py-sm text-on-surface-variant font-semibold">Manager</th>
                <th
                  className="text-center px-md py-sm text-on-surface-variant font-semibold cursor-pointer hover:text-on-surface select-none"
                  onClick={() => toggleSort("direct_reports")}
                >
                  <span className="inline-flex items-center gap-xs justify-center">
                    Reports <SortIcon k="direct_reports" />
                  </span>
                </th>
                <th
                  className="text-center px-md py-sm text-on-surface-variant font-semibold cursor-pointer hover:text-on-surface select-none"
                  onClick={() => toggleSort("avg_turnaround_days")}
                >
                  <span className="inline-flex items-center gap-xs justify-center">
                    Turnaround <SortIcon k="avg_turnaround_days" />
                  </span>
                </th>
                <th
                  className="text-center px-md py-sm text-on-surface-variant font-semibold cursor-pointer hover:text-on-surface select-none"
                  onClick={() => toggleSort("avg_team_score")}
                >
                  <span className="inline-flex items-center gap-xs justify-center">
                    Team Score <SortIcon k="avg_team_score" />
                  </span>
                </th>
                <th
                  className="text-center px-md py-sm text-on-surface-variant font-semibold cursor-pointer hover:text-on-surface select-none"
                  onClick={() => toggleSort("checkin_rate")}
                >
                  <span className="inline-flex items-center gap-xs justify-center">
                    Checkin Rate <SortIcon k="checkin_rate" />
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((row: ManagerEffectivenessRow, i) => (
                <tr
                  key={row.manager_id}
                  className={cn(
                    "border-b border-outline-variant/50 transition-colors hover:bg-surface-container-low/50",
                    i % 2 === 0 ? "bg-surface-container-lowest" : "bg-surface-container-low/20"
                  )}
                >
                  <td className="px-md py-sm font-medium text-on-surface">{row.manager_name}</td>
                  <td className="px-md py-sm text-center text-on-surface-variant">{row.direct_reports}</td>
                  <td className="px-md py-sm text-center text-on-surface-variant">
                    {row.avg_turnaround_days != null ? `${row.avg_turnaround_days}d` : "—"}
                  </td>
                  <td className="px-md py-sm text-center">
                    {row.avg_team_score != null ? (
                      <span
                        className={cn(
                          "font-semibold",
                          row.avg_team_score >= 80
                            ? "text-green-600"
                            : row.avg_team_score >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                        )}
                      >
                        {row.avg_team_score}%
                      </span>
                    ) : (
                      <span className="text-on-surface-variant">—</span>
                    )}
                  </td>
                  <td className="px-md py-sm text-center">
                    <div className="inline-flex flex-col items-center gap-xs">
                      <span
                        className={cn(
                          "font-bold text-label-md",
                          row.checkin_rate >= 80
                            ? "text-green-600"
                            : row.checkin_rate >= 50
                            ? "text-amber-600"
                            : "text-red-600"
                        )}
                      >
                        {row.checkin_rate.toFixed(1)}%
                      </span>
                      <div className="w-16 h-1.5 rounded-full bg-surface-container-high overflow-hidden">
                        <div
                          className={cn(
                            "h-full rounded-full",
                            row.checkin_rate >= 80
                              ? "bg-green-500"
                              : row.checkin_rate >= 50
                              ? "bg-amber-400"
                              : "bg-red-500"
                          )}
                          style={{ width: `${row.checkin_rate}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

const TABS = [
  { id: "qoq", label: "QoQ Trends", icon: "show_chart" },
  { id: "heatmap", label: "Completion Heatmap", icon: "grid_view" },
  { id: "distribution", label: "Goal Distribution", icon: "donut_large" },
  { id: "managers", label: "Manager Effectiveness", icon: "supervisor_account" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("qoq");
  const activeWindow = useCycleStore((s) => s.activeWindow);

  // Fetch all cycle configs and extract GOAL_SETTING cycles as fiscal-year options
  const { data: allCycles = [] } = useQuery({
    queryKey: ["admin-cycles-for-analytics"],
    queryFn: () => adminService.getCycleConfigs(),
  });

  const fyOptions = useMemo(() => {
    return allCycles
      .filter((c) => c.phase === CyclePhase.GOAL_SETTING)
      .sort((a, b) => b.cycleName.localeCompare(a.cycleName));
  }, [allCycles]);

  // Default FY = the one matching the active window's cycle name, else first available
  const defaultFY = activeWindow?.cycleName ?? fyOptions[0]?.cycleName ?? "";
  const [selectedFY, setSelectedFY] = useState<string>("");

  const effectiveFY = selectedFY || defaultFY;
  const selectedCycle = fyOptions.find((c) => c.cycleName === effectiveFY);
  const cycleId = selectedCycle?.id ?? "";

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-md">
        <div>
          <h2 className="text-headline-lg text-on-surface">Analytics</h2>
          <p className="text-body-lg text-on-surface-variant mt-xs">
            Strategic insights aggregated from achievement, check-in, and goal data across the organisation.
          </p>
        </div>
        {/* Fiscal year selector */}
        {fyOptions.length > 0 && (
          <div className="flex items-center gap-sm shrink-0">
            <span className="text-label-md text-on-surface-variant">Fiscal Year</span>
            <select
              value={effectiveFY}
              onChange={(e) => setSelectedFY(e.target.value)}
              className="rounded-lg border border-outline-variant bg-surface-container-low px-md py-sm text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              {fyOptions.map((c) => (
                <option key={c.id} value={c.cycleName}>
                  {c.cycleName}
                  {c.cycleName === activeWindow?.cycleName ? " (Active)" : ""}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-xs flex-wrap border-b border-outline-variant pb-xs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "inline-flex items-center gap-sm px-md py-sm text-label-lg font-medium rounded-t-lg transition-colors",
              activeTab === tab.id
                ? "text-primary border-b-2 border-primary bg-primary/5"
                : "text-on-surface-variant hover:text-on-surface hover:bg-surface-container-low"
            )}
          >
            <span className="material-symbols-outlined text-[20px]">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div>
        {!cycleId ? (
          <div className="rounded-xl border border-outline-variant p-xl text-center text-on-surface-variant">
            No goal-setting cycle found. Run the seed script or configure a cycle to see analytics data.
          </div>
        ) : activeTab === "qoq" ? (
          <QoQTrendTab cycleId={cycleId} />
        ) : activeTab === "heatmap" ? (
          <HeatmapTab cycleId={cycleId} />
        ) : activeTab === "distribution" ? (
          <GoalDistributionTab cycleId={cycleId} />
        ) : (
          <ManagerEffectivenessTab cycleId={cycleId} />
        )}
      </div>
    </div>
  );
}
