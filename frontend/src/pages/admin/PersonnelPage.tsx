import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { useAllGoals } from "@/hooks/useGoals";
import {
  useAllUsers,
  useApproveSheet,
  useReturnForRework,
  useInlineEditGoal,
} from "@/hooks/useApprovals";
import { useUnlockSheet } from "@/hooks/useAdmin";
import { useCycleStore } from "@/store/cycleStore";
import { GoalStatus } from "@/types/goal.types";
import type { Goal, UoMType } from "@/types/goal.types";
import { UOM_TYPE_META } from "@/constants/uomTypes";
import { ROUTES } from "@/constants/routes";
import { formatThrustArea } from "@/utils/format.util";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ColumnId = "draft" | "submitted" | "approved" | "rejected";

interface ColumnDef {
  id: ColumnId;
  title: string;
  dot: string;
  emptyMsg: string;
}

const COLUMNS: ColumnDef[] = [
  { id: "draft",     title: "Draft Goals",     dot: "bg-on-surface-variant", emptyMsg: "No drafts" },
  { id: "submitted", title: "Pending Review",  dot: "bg-blue-500",            emptyMsg: "Nothing awaiting review" },
  { id: "approved",  title: "Approved Goals",  dot: "bg-emerald-500",         emptyMsg: "No approved goals yet" },
  { id: "rejected",  title: "Rejected Goals",  dot: "bg-rose-500",            emptyMsg: "No rejections" },
];

const COLUMN_ACCENT: Record<ColumnId, { stripe: string; ring: string; icon: string; iconBg: string }> = {
  draft:     { stripe: "bg-slate-300",   ring: "hover:ring-slate-300/60",   icon: "edit_note",     iconBg: "bg-slate-100 text-slate-600" },
  submitted: { stripe: "bg-blue-500",    ring: "hover:ring-blue-300/60",    icon: "hourglass_top", iconBg: "bg-blue-50 text-blue-600" },
  approved:  { stripe: "bg-emerald-500", ring: "hover:ring-emerald-300/60", icon: "check_circle",  iconBg: "bg-emerald-50 text-emerald-600" },
  rejected:  { stripe: "bg-rose-500",    ring: "hover:ring-rose-300/60",    icon: "error",         iconBg: "bg-rose-50 text-rose-600" },
};

const GOAL_STATUS_CHIP: Record<string, { cls: string; label: string }> = {
  [GoalStatus.DRAFT]:        { cls: "bg-surface-variant text-on-surface-variant", label: "Draft" },
  [GoalStatus.SUBMITTED]:    { cls: "bg-secondary-container text-on-secondary-container", label: "Submitted" },
  [GoalStatus.UNDER_REVIEW]: { cls: "bg-secondary-container text-on-secondary-container", label: "Under Review" },
  [GoalStatus.APPROVED]:     { cls: "bg-tertiary/10 text-tertiary", label: "Approved" },
  [GoalStatus.LOCKED]:       { cls: "bg-tertiary/10 text-tertiary", label: "Locked" },
  [GoalStatus.ARCHIVED]:     { cls: "bg-surface-variant text-on-surface-variant", label: "Archived" },
};

function classifyGoal(g: Goal): ColumnId | null {
  switch (g.status) {
    case "draft":
      return (g as any).managerComment ? "rejected" : "draft";
    case "submitted":
    case "under-review":
      return "submitted";
    case "approved":
    case "locked":
      return "approved";
    default:
      return null;
  }
}

function formatTarget(g: any): string {
  if (g.uomType === "TIMELINE") {
    return g.targetDate
      ? new Date(g.targetDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
      : "—";
  }
  return g.targetValue != null ? String(g.targetValue) : "—";
}

// A goal sheet reconstructed from the org-wide goals feed — carries just the
// fields the approve / return / inline-edit dispatch needs.
interface SheetLite {
  id: string;
  userId: string;
  goals: Goal[];
}

interface UserInfo {
  fullName: string;
  departmentName?: string;
  managerName?: string;
  role?: string;
}

function roleLabel(role?: string): string {
  if (!role) return "—";
  return role.charAt(0).toUpperCase() + role.slice(1);
}

interface PersonnelGoalCardProps {
  goal: any;
  column: ColumnId;
  onView: (g: any) => void;
  onEdit?: (g: any) => void;
  onDragStart?: (g: any) => void;
  onDragEnd?: () => void;
  isDragging?: boolean;
}

function PersonnelGoalKanbanCard({ goal, column, onView, onEdit, onDragStart, onDragEnd, isDragging }: Readonly<PersonnelGoalCardProps>) {
  const accent = COLUMN_ACCENT[column];
  const weightage = Math.max(0, Math.min(100, Number(goal.weightage) || 0));
  const rejectionNote = column === "rejected" ? goal.managerComment : null;
  const uomMeta = UOM_TYPE_META[goal.uomType as UoMType];
  const draggable = column === "submitted";

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => {
        if (!draggable) return;
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", goal.id);
        onDragStart?.(goal);
      }}
      onDragEnd={() => onDragEnd?.()}
      onClick={() => onView(goal)}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onView(goal);
        }
      }}
      className={[
        "group relative w-full text-left bg-white rounded-xl border border-outline-variant overflow-hidden shadow-sm transition-all duration-200",
        "hover:shadow-md hover:-translate-y-0.5 hover:ring-2",
        accent.ring,
        draggable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer",
        isDragging ? "opacity-40 rotate-1 scale-[0.98]" : "",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary",
      ].join(" ")}
    >
      {/* Left accent stripe */}
      <span className={`absolute left-0 top-0 bottom-0 w-1 ${accent.stripe}`} aria-hidden />

      <div className="pl-3 pr-3 py-3">
        {/* Header row: status icon + title + edit */}
        <div className="flex items-start gap-2 mb-2">
          <span className={`shrink-0 inline-flex items-center justify-center w-6 h-6 rounded-md ${accent.iconBg}`}>
            <span className="material-symbols-outlined text-[15px]">{accent.icon}</span>
          </span>
          <h4 className="flex-1 text-[13px] font-semibold text-on-surface leading-snug line-clamp-2 pr-5">
            {goal.title}
          </h4>
          {column === "submitted" && onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(goal); }}
              title="Edit goal"
              className="absolute top-2 right-2 p-1 rounded-full text-on-surface-variant hover:text-primary hover:bg-primary-container/40 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
            >
              <span className="material-symbols-outlined text-[16px]">edit</span>
            </button>
          )}
        </div>

        {/* Tag chips */}
        <div className="flex flex-wrap gap-1 mb-2.5">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-50 text-amber-800 border border-amber-200 text-[10.5px] font-medium">
            <span className="material-symbols-outlined text-[12px] leading-none">flag</span>
            {formatThrustArea(goal.thrustArea)}
          </span>
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-sky-50 text-sky-800 border border-sky-200 text-[10.5px] font-medium">
            <span className="material-symbols-outlined text-[12px] leading-none">trending_up</span>
            {uomMeta?.label ?? goal.uomType}
          </span>
          {goal.isShared && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-secondary-container text-on-secondary-container border border-outline-variant/50 text-[10.5px] font-medium">
              <span className="material-symbols-outlined text-[12px] leading-none">share</span>
              Shared
            </span>
          )}
        </div>

        {/* Metrics block */}
        <div className="rounded-lg bg-surface-container/50 border border-outline-variant/60 px-2.5 py-2 space-y-1.5">
          <div className="flex items-center justify-between text-[12px]">
            <span className="inline-flex items-center gap-1 text-on-surface-variant">
              <span className="material-symbols-outlined text-[13px] leading-none">target</span>
              Target
            </span>
            <span className="font-semibold text-on-surface tabular-nums">{formatTarget(goal)}</span>
          </div>

          <div>
            <div className="flex items-center justify-between text-[12px] mb-1">
              <span className="inline-flex items-center gap-1 text-on-surface-variant">
                <span className="material-symbols-outlined text-[13px] leading-none">monitoring</span>
                Weightage
              </span>
              <span className="font-semibold text-on-surface tabular-nums">{weightage}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-outline-variant/50 overflow-hidden">
              <div
                className={`h-full rounded-full ${accent.stripe} transition-all`}
                style={{ width: `${weightage}%` }}
              />
            </div>
          </div>
        </div>

        {/* Rejection comment (only for rejected) */}
        {rejectionNote && (
          <div className="mt-2 rounded-md border border-rose-200 bg-rose-50 px-2 py-1.5 text-[11px] text-rose-800 flex gap-1.5">
            <span className="material-symbols-outlined text-[13px] leading-none mt-px">comment</span>
            <span className="line-clamp-2">{rejectionNote}</span>
          </div>
        )}
      </div>
    </div>
  );
}

interface PickerOption {
  id: string;
  fullName: string;
  subtitle: string;
  pendingCount: number;
}

interface FilterPickerProps {
  /** Label for the "show everything" default option, e.g. "All Managers" */
  allLabel: string;
  allIcon: string;
  allSubtitle: string;
  searchPlaceholder: string;
  options: PickerOption[];
  value: string;
  onChange: (id: string) => void;
}

function initialsOf(name: string): string {
  return (name ?? "??")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FilterPicker({
  allLabel,
  allIcon,
  allSubtitle,
  searchPlaceholder,
  options,
  value,
  onChange,
}: Readonly<FilterPickerProps>) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const selected = options.find((o) => o.id === value);

  const filtered = useMemo(() => {
    if (!search.trim()) return options;
    const q = search.toLowerCase();
    return options.filter(
      (o) =>
        o.fullName.toLowerCase().includes(q) ||
        o.subtitle.toLowerCase().includes(q)
    );
  }, [options, search]);

  return (
    <div ref={rootRef} className="relative min-w-[240px] flex-1 sm:max-w-[300px]">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          "w-full flex items-center gap-sm py-sm pl-sm pr-md rounded-lg border bg-surface-container-lowest shadow-sm transition-all",
          "hover:bg-surface-container-low",
          open
            ? "border-primary ring-2 ring-primary/20"
            : "border-outline-variant"
        )}
      >
        {selected ? (
          <>
            <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-semibold shrink-0">
              {initialsOf(selected.fullName)}
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-title-md text-on-surface truncate leading-tight">{selected.fullName}</p>
              <p className="text-label-md text-on-surface-variant truncate leading-tight">{selected.subtitle}</p>
            </div>
          </>
        ) : (
          <>
            <div className="w-9 h-9 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[18px]">{allIcon}</span>
            </div>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-title-md text-on-surface truncate leading-tight">{allLabel}</p>
              <p className="text-label-md text-on-surface-variant truncate leading-tight">{allSubtitle}</p>
            </div>
          </>
        )}
        <span className={cn(
          "material-symbols-outlined text-on-surface-variant transition-transform",
          open ? "rotate-180" : ""
        )}>
          expand_more
        </span>
      </button>

      {open && (
        <div className="absolute z-30 top-[calc(100%+6px)] left-0 right-0 bg-white rounded-xl border border-outline-variant shadow-level-3 overflow-hidden animate-in fade-in slide-in-from-top-1">
          {/* Search */}
          <div className="px-sm py-sm border-b border-outline-variant bg-surface-container/40">
            <div className="relative">
              <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-[16px]">search</span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={searchPlaceholder}
                autoFocus
                className="w-full pl-lg pr-sm py-1.5 bg-white border border-outline-variant rounded-md text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
              />
            </div>
          </div>

          <ul className="max-h-72 overflow-y-auto py-1" role="listbox">
            {/* Default "all" option */}
            <li>
              <button
                type="button"
                role="option"
                aria-selected={value === ""}
                onClick={() => { onChange(""); setOpen(false); setSearch(""); }}
                className={cn(
                  "w-full flex items-center gap-sm px-sm py-2 text-left transition-colors",
                  value === "" ? "bg-primary-container/30" : "hover:bg-surface-container-low"
                )}
              >
                <div className="w-8 h-8 rounded-full bg-primary text-on-primary flex items-center justify-center shrink-0">
                  <span className="material-symbols-outlined text-[16px]">{allIcon}</span>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-title-md text-on-surface truncate leading-tight">{allLabel}</p>
                  <p className="text-label-md text-on-surface-variant truncate leading-tight">{allSubtitle}</p>
                </div>
                {value === "" && (
                  <span className="material-symbols-outlined text-primary text-[18px]">check</span>
                )}
              </button>
            </li>

            {filtered.length === 0 && (
              <li className="px-md py-lg text-center text-body-md text-on-surface-variant">
                No one matches "{search}"
              </li>
            )}

            {filtered.map((person) => {
              const isSelected = person.id === value;
              return (
                <li key={person.id}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => { onChange(person.id); setOpen(false); setSearch(""); }}
                    className={cn(
                      "w-full flex items-center gap-sm px-sm py-2 text-left transition-colors",
                      isSelected ? "bg-primary-container/30" : "hover:bg-surface-container-low"
                    )}
                  >
                    <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-label-md font-semibold shrink-0">
                      {initialsOf(person.fullName)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-title-md text-on-surface truncate leading-tight">{person.fullName}</p>
                      <p className="text-label-md text-on-surface-variant truncate leading-tight">{person.subtitle}</p>
                    </div>
                    {person.pendingCount > 0 && (
                      <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                        <span className="material-symbols-outlined text-[12px] leading-none">hourglass_top</span>
                        {person.pendingCount}
                      </span>
                    )}
                    {isSelected && (
                      <span className="material-symbols-outlined text-primary text-[18px]">check</span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

export default function PersonnelPage() {
  const navigate = useNavigate();
  const { userId: adminId = "" } = useParams<{ userId: string }>();
  const { activeWindow } = useCycleStore();
  const cycleLabel = activeWindow?.cycleName ?? "Current Cycle";
  const cycleId = activeWindow?.id ?? "";

  const { data: allGoals = [], isLoading: goalsLoading } = useAllGoals(cycleId);
  const { data: allUsers = [], isLoading: usersLoading } = useAllUsers();

  const approveSheet = useApproveSheet();
  const returnForRework = useReturnForRework();
  const inlineEdit = useInlineEditGoal();

  const [nameFilter, setNameFilter] = useState("");
  const [managerFilter, setManagerFilter] = useState("");
  const [employeeFilter, setEmployeeFilter] = useState("");
  const [viewGoal, setViewGoal] = useState<any | null>(null);

  // Drag state
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverKey, setDragOverKey] = useState<string | null>(null);

  // Action dialog state
  const [approveTarget, setApproveTarget] = useState<{ sheet: SheetLite; user?: UserInfo } | null>(null);
  const [rejectTarget, setRejectTarget] = useState<{ sheet: SheetLite; user?: UserInfo } | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [editTarget, setEditTarget] = useState<{ goal: any; sheet: SheetLite } | null>(null);
  const [unlockTarget, setUnlockTarget] = useState<{ sheet: SheetLite; user?: UserInfo } | null>(null);
  const [unlockReason, setUnlockReason] = useState("");
  const unlockSheet = useUnlockSheet();

  const isLoading = goalsLoading || usersLoading;

  const usersById = useMemo(() => {
    const map: Record<string, UserInfo> = {};
    for (const u of allUsers as any[]) {
      map[u.id] = {
        fullName: u.fullName,
        departmentName: u.departmentName,
        managerName: u.managerName,
        role: u.role,
      };
    }
    return map;
  }, [allUsers]);

  // Reconstruct goal sheets from the org-wide goals feed (admins have no
  // /team sheet endpoint — every goal carries its parent goalSheetId).
  const sheetByGoalId = useMemo(() => {
    const sheets = new Map<string, SheetLite>();
    for (const g of allGoals as Goal[]) {
      if (!g.goalSheetId) continue;
      let s = sheets.get(g.goalSheetId);
      if (!s) {
        s = { id: g.goalSheetId, userId: g.userId, goals: [] };
        sheets.set(g.goalSheetId, s);
      }
      s.goals.push(g);
    }
    const byGoal = new Map<string, SheetLite>();
    for (const s of sheets.values()) {
      for (const g of s.goals) byGoal.set(g.id, s);
    }
    return byGoal;
  }, [allGoals]);

  // Per-user goal counts (from the full org-wide goals feed)
  const statsByUser = useMemo(() => {
    const m = new Map<string, { goalCount: number; pendingCount: number }>();
    for (const g of allGoals as Goal[]) {
      const s = m.get(g.userId) ?? { goalCount: 0, pendingCount: 0 };
      s.goalCount += 1;
      if (g.status === GoalStatus.SUBMITTED || g.status === GoalStatus.UNDER_REVIEW) {
        s.pendingCount += 1;
      }
      m.set(g.userId, s);
    }
    return m;
  }, [allGoals]);

  const selectedManagerName = managerFilter
    ? usersById[managerFilter]?.fullName
    : undefined;

  // Dropdown 1 — managers. Subtitle aggregates each manager's direct reports.
  const managerOptions: PickerOption[] = useMemo(() => {
    const employees = (allUsers as any[]).filter((u) => u.role === "employee");
    return (allUsers as any[])
      .filter((u) => u.role === "manager")
      .map((m) => {
        const reports = employees.filter((e) => e.managerName === m.fullName);
        const pending = reports.reduce(
          (sum, r) => sum + (statsByUser.get(r.id)?.pendingCount ?? 0),
          0
        );
        return {
          id: m.id,
          fullName: m.fullName,
          subtitle: `${reports.length} report${reports.length === 1 ? "" : "s"} · ${pending} pending`,
          pendingCount: pending,
        };
      })
      .sort((a, b) => {
        if (a.pendingCount !== b.pendingCount) return b.pendingCount - a.pendingCount;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [allUsers, statsByUser]);

  // Dropdown 2 — employees, cascading off the selected manager.
  const employeeOptions: PickerOption[] = useMemo(() => {
    return (allUsers as any[])
      .filter((u) => u.role === "employee")
      .filter((u) => !selectedManagerName || u.managerName === selectedManagerName)
      .map((u) => {
        const stats = statsByUser.get(u.id) ?? { goalCount: 0, pendingCount: 0 };
        return {
          id: u.id,
          fullName: u.fullName,
          subtitle: `${u.managerName ? `Manager — ${u.managerName}` : "No manager"} · ${stats.goalCount} goal${stats.goalCount === 1 ? "" : "s"}`,
          pendingCount: stats.pendingCount,
        };
      })
      .sort((a, b) => {
        if (a.pendingCount !== b.pendingCount) return b.pendingCount - a.pendingCount;
        return a.fullName.localeCompare(b.fullName);
      });
  }, [allUsers, selectedManagerName, statsByUser]);

  const totalGoals = (allGoals as Goal[]).length;

  const filtered = useMemo(() => {
    return (allGoals as Goal[]).filter((goal) => {
      const user = usersById[goal.userId];
      // Employee selection wins — show just that one person.
      if (employeeFilter) {
        if (goal.userId !== employeeFilter) return false;
      } else if (managerFilter) {
        // Otherwise, a manager selection scopes to that manager's reports.
        if (!user || user.managerName !== selectedManagerName) return false;
      }
      if (nameFilter) {
        const haystack = `${user?.fullName ?? ""} ${user?.managerName ?? ""} ${goal.title ?? ""}`.toLowerCase();
        if (!haystack.includes(nameFilter.toLowerCase())) return false;
      }
      return true;
    });
  }, [allGoals, nameFilter, employeeFilter, managerFilter, selectedManagerName, usersById]);

  // Group filtered goals by person, and within each person by column
  type PersonBoard = {
    userId: string;
    user?: UserInfo;
    grouped: Record<ColumnId, any[]>;
    total: number;
    weightageSum: number;
  };

  const boards: PersonBoard[] = useMemo(() => {
    const byUser = new Map<string, PersonBoard>();
    for (const g of filtered) {
      const c = classifyGoal(g as Goal);
      if (!c) continue;
      let b = byUser.get(g.userId);
      if (!b) {
        b = {
          userId: g.userId,
          user: usersById[g.userId],
          grouped: { draft: [], submitted: [], approved: [], rejected: [] },
          total: 0,
          weightageSum: 0,
        };
        byUser.set(g.userId, b);
      }
      b.grouped[c].push(g);
      b.total += 1;
      b.weightageSum += Number(g.weightage) || 0;
    }
    // Sort: people with pending review first, then by name
    return Array.from(byUser.values()).sort((a, b) => {
      const ap = a.grouped.submitted.length > 0 ? 0 : 1;
      const bp = b.grouped.submitted.length > 0 ? 0 : 1;
      if (ap !== bp) return ap - bp;
      return (a.user?.fullName ?? "").localeCompare(b.user?.fullName ?? "");
    });
  }, [filtered, usersById]);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto w-full space-y-xl">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <p className="text-label-md text-primary uppercase tracking-wider mb-1">{cycleLabel}</p>
          <h2 className="text-display-lg text-on-surface mb-xs">View Personnel</h2>
          <p className="text-body-lg text-on-surface-variant">
            Every employee and manager across the organisation, grouped by stage. Click a card for details — drag a
            pending card to approve or return it.
          </p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-xs px-lg py-sm bg-primary text-on-primary rounded-lg text-label-lg font-medium hover:opacity-90 transition shrink-0"
            >
              <span className="material-symbols-outlined text-[18px]">person_add</span>
              Add New Personnel
              <span className="material-symbols-outlined text-[18px]">expand_more</span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[200px]">
            <DropdownMenuItem onSelect={() => navigate(ROUTES.ADMIN.PERSONNEL_NEW_MANAGER(adminId))}>
              <span className="material-symbols-outlined text-[18px] mr-xs">supervisor_account</span>
              Add New Manager
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate(ROUTES.ADMIN.PERSONNEL_NEW_EMPLOYEE(adminId))}>
              <span className="material-symbols-outlined text-[18px] mr-xs">badge</span>
              Add New Employee
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Filters — two connected dropdowns: Managers → Employees */}
      <div className="flex flex-wrap items-center gap-sm">
        <FilterPicker
          allLabel="All Managers"
          allIcon="supervisor_account"
          allSubtitle={`${managerOptions.length} manager${managerOptions.length === 1 ? "" : "s"}`}
          searchPlaceholder="Search managers..."
          options={managerOptions}
          value={managerFilter}
          onChange={(id) => { setManagerFilter(id); setEmployeeFilter(""); }}
        />
        <FilterPicker
          allLabel="All Employees"
          allIcon="groups"
          allSubtitle={
            selectedManagerName
              ? `${employeeOptions.length} under ${selectedManagerName}`
              : `${employeeOptions.length} employee${employeeOptions.length === 1 ? "" : "s"}`
          }
          searchPlaceholder="Search employees..."
          options={employeeOptions}
          value={employeeFilter}
          onChange={setEmployeeFilter}
        />
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-[18px]">search</span>
          <input
            type="text"
            placeholder="Search goal title, person, or manager..."
            value={nameFilter}
            onChange={(e) => setNameFilter(e.target.value)}
            className="w-full pl-xl pr-sm py-sm bg-surface-container-low border border-outline-variant rounded-lg text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        {(nameFilter || managerFilter || employeeFilter) && (
          <button
            onClick={() => { setNameFilter(""); setManagerFilter(""); setEmployeeFilter(""); }}
            className="text-on-surface-variant hover:text-on-surface text-body-md flex items-center gap-xs px-sm py-sm rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">close</span>
            Clear
          </button>
        )}
        <span className="ml-auto text-label-md text-on-surface-variant">
          Showing {filtered.length} of {totalGoals} goals
        </span>
      </div>

      {/* Per-person Kanban boards */}
      {(() => {
        if (isLoading) {
          return (
            <div className="space-y-lg">
              {[1, 2].map((i) => (
                <div key={i} className="rounded-2xl border border-outline-variant bg-surface-container-lowest p-md">
                  <div className="h-10 w-64 bg-surface-container-low rounded-md animate-pulse mb-md" />
                  <div className="grid grid-cols-4 gap-3">
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className="h-48 bg-surface-container-low rounded-xl animate-pulse" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          );
        }
        if (boards.length === 0) {
          return (
            <div className="bg-surface-container-lowest border border-outline-variant rounded-xl p-xl text-center">
              <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">manage_search</span>
              <p className="text-body-lg text-on-surface-variant mt-md">
                {(allGoals as Goal[]).length === 0 ? "No goals found across the organisation" : "No goals match your filters"}
              </p>
            </div>
          );
        }
        return (
          <div className="space-y-lg">
            {boards.map((board) => {
              const fullName = board.user?.fullName ?? "Unknown";
              const initials = fullName
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();
              const weightageRounded = Math.round(board.weightageSum * 100) / 100;
              const pendingHere = board.grouped.submitted.length;
              const managerName = board.user?.managerName;
              return (
                <section
                  key={board.userId}
                  className="rounded-2xl border border-outline-variant bg-surface-container-lowest shadow-sm overflow-hidden"
                >
                  {/* Person header */}
                  <div className="px-md py-md border-b border-outline-variant bg-surface-container/40 flex items-center gap-md flex-wrap">
                    <div className="w-10 h-10 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-title-md font-semibold shrink-0">
                      {initials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-title-lg text-on-surface truncate">
                        {fullName}
                        {managerName && (
                          <span className="text-on-surface-variant font-normal"> (Manager — {managerName})</span>
                        )}
                      </h3>
                      <p className="text-label-md text-on-surface-variant truncate">
                        {roleLabel(board.user?.role)} · {board.user?.departmentName ?? "—"}
                      </p>
                    </div>
                    <div className="flex items-center gap-xs flex-wrap">
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-surface-container border border-outline-variant text-[11px] text-on-surface-variant">
                        <span className="material-symbols-outlined text-[13px] leading-none">flag</span>
                        {board.total} goal{board.total === 1 ? "" : "s"}
                      </span>
                      <span className={cn(
                        "inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[11px] font-medium",
                        weightageRounded === 100
                          ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                          : "bg-amber-50 text-amber-800 border-amber-200"
                      )}>
                        <span className="material-symbols-outlined text-[13px] leading-none">
                          {weightageRounded === 100 ? "check_circle" : "pending"}
                        </span>
                        {weightageRounded}% weightage
                      </span>
                      {pendingHere > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-medium">
                          <span className="material-symbols-outlined text-[13px] leading-none">hourglass_top</span>
                          {pendingHere} pending
                        </span>
                      )}
                      {(() => {
                        const approvedGoal = board.grouped.approved[0];
                        const fallbackGoal = board.grouped.submitted[0] ?? board.grouped.draft[0] ?? board.grouped.rejected[0];
                        const anyGoal = approvedGoal ?? fallbackGoal;
                        const sheet = anyGoal ? sheetByGoalId.get(anyGoal.id) : undefined;
                        const canUnlock = !!sheet && board.grouped.approved.length > 0;
                        const tooltip = canUnlock
                          ? "Move this sheet back to draft so the employee can edit"
                          : "No approved/locked goals to unlock yet";
                        return (
                          <button
                            type="button"
                            disabled={!canUnlock}
                            onClick={() => {
                              if (!canUnlock || !sheet) return;
                              setUnlockReason("");
                              setUnlockTarget({ sheet, user: board.user });
                            }}
                            className={cn(
                              "inline-flex items-center gap-1.5 px-md py-1.5 rounded-lg text-label-md shadow-level-1 border-t border-white/20 transition-colors",
                              canUnlock
                                ? "bg-amber-600 text-white hover:bg-amber-700"
                                : "bg-surface-container text-on-surface-variant border border-outline-variant opacity-60 cursor-not-allowed"
                            )}
                            title={tooltip}
                          >
                            <span className="material-symbols-outlined text-[16px] leading-none">lock_open_right</span>
                            Unlock Goals
                          </button>
                        );
                      })()}
                    </div>
                  </div>

                  {/* Kanban for this person */}
                  <div
                    className="w-full overflow-x-auto p-md"
                    data-person={board.userId}
                  >
                    <div className="grid grid-cols-4 gap-3 min-w-[1000px]">
                      {COLUMNS.map((col) => {
                        const items = board.grouped[col.id];
                        const dropKey = `${board.userId}:${col.id}`;
                        const isDropTarget = col.id === "approved" || col.id === "rejected";
                        const isHovered = dragOverKey === dropKey && isDropTarget;
                        return (
                          <div
                            key={col.id}
                            onDragOver={(e) => {
                              if (!isDropTarget || draggingId == null) return;
                              // Only allow same-person drops
                              const draggedSheet = sheetByGoalId.get(draggingId);
                              if (!draggedSheet || draggedSheet.userId !== board.userId) return;
                              e.preventDefault();
                              e.dataTransfer.dropEffect = "move";
                              if (dragOverKey !== dropKey) setDragOverKey(dropKey);
                            }}
                            onDragLeave={() => {
                              if (dragOverKey === dropKey) setDragOverKey(null);
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              setDragOverKey(null);
                              const id = draggingId;
                              setDraggingId(null);
                              if (!id || !isDropTarget) return;
                              const sheet = sheetByGoalId.get(id);
                              if (!sheet || sheet.userId !== board.userId) return;
                              if (col.id === "approved") {
                                setApproveTarget({ sheet, user: board.user });
                              } else {
                                setRejectReason("");
                                setRejectTarget({ sheet, user: board.user });
                              }
                            }}
                            className={cn(
                              "rounded-xl border border-outline-variant bg-surface-container-lowest flex flex-col overflow-hidden transition-all",
                              isHovered && col.id === "approved" && "ring-2 ring-emerald-400 border-emerald-300 bg-emerald-50/40",
                              isHovered && col.id === "rejected" && "ring-2 ring-rose-400 border-rose-300 bg-rose-50/40",
                            )}
                          >
                            <div className="px-3 py-2.5 border-b border-outline-variant flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${col.dot}`} />
                                <h4 className="text-[13px] font-semibold text-on-surface">{col.title}</h4>
                              </div>
                              <span className="text-[12px] text-on-surface-variant tabular-nums">{items.length}</span>
                            </div>
                            <div className="p-2.5 flex-1 space-y-2.5 min-h-[220px] max-h-[440px] overflow-y-auto bg-surface-container/30 [scrollbar-width:thin]">
                              {items.length === 0 ? (
                                <div className="h-full min-h-[200px] flex items-center justify-center text-center text-on-surface-variant">
                                  <p className="text-[12px]">{col.emptyMsg}</p>
                                </div>
                              ) : (
                                items.map((goal: any) => (
                                  <PersonnelGoalKanbanCard
                                    key={goal.id}
                                    goal={goal}
                                    column={col.id}
                                    onView={setViewGoal}
                                    onEdit={(g) => {
                                      const sheet = sheetByGoalId.get(g.id);
                                      if (sheet) setEditTarget({ goal: g, sheet });
                                    }}
                                    onDragStart={(g) => setDraggingId(g.id)}
                                    onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                                    isDragging={draggingId === goal.id}
                                  />
                                ))
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>
              );
            })}
          </div>
        );
      })()}

      {/* Goal detail sheet */}
      <Sheet open={viewGoal !== null} onOpenChange={(open) => !open && setViewGoal(null)}>
        <SheetContent side="right" className="w-full sm:max-w-lg overflow-y-auto p-0 bg-surface">
          {viewGoal && (() => {
            const col = classifyGoal(viewGoal as Goal) ?? "draft";
            const accent = COLUMN_ACCENT[col];
            const chip = GOAL_STATUS_CHIP[viewGoal.status] ?? GOAL_STATUS_CHIP[GoalStatus.DRAFT];
            const owner = usersById[viewGoal.userId];
            const ownerInitials = (owner?.fullName ?? "??")
              .split(" ")
              .map((n: string) => n[0])
              .join("")
              .slice(0, 2)
              .toUpperCase();
            const weightage = Math.max(0, Math.min(100, Number(viewGoal.weightage) || 0));
            const sheet = sheetByGoalId.get(viewGoal.id);
            return (
              <>
                {/* Hero header */}
                <div className={cn("relative px-lg pt-lg pb-md", "bg-gradient-to-br from-primary-container/40 to-surface-container/30")}>
                  <span className={`absolute left-0 top-0 bottom-0 w-1.5 ${accent.stripe}`} aria-hidden />
                  <SheetHeader className="mb-md">
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`inline-flex items-center justify-center w-8 h-8 rounded-lg ${accent.iconBg}`}>
                        <span className="material-symbols-outlined text-[18px]">{accent.icon}</span>
                      </span>
                      <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-label-sm uppercase tracking-wider", chip.cls)}>
                        {chip.label}
                      </span>
                      {viewGoal.isShared && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary-container text-on-secondary-container text-label-sm">
                          <span className="material-symbols-outlined text-[12px] leading-none">share</span>
                          Shared
                        </span>
                      )}
                    </div>
                    <SheetTitle className="text-headline-sm text-on-surface leading-snug">
                      {viewGoal.title}
                    </SheetTitle>
                  </SheetHeader>
                  {/* Owner card */}
                  <div className="flex items-center gap-sm bg-surface-container-lowest/80 backdrop-blur rounded-xl border border-outline-variant px-sm py-2">
                    <div className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-title-sm font-semibold shrink-0">
                      {ownerInitials}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-title-sm text-on-surface truncate leading-tight">
                        {owner?.fullName ?? "Unknown"}
                        {owner?.managerName && (
                          <span className="text-on-surface-variant font-normal"> (Manager — {owner.managerName})</span>
                        )}
                      </p>
                      <p className="text-label-md text-on-surface-variant truncate leading-tight">
                        {roleLabel(owner?.role)} · {owner?.departmentName ?? "—"}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Body */}
                <div className="px-lg py-md space-y-lg">
                  {viewGoal.description && (
                    <section>
                      <p className="text-label-md text-on-surface-variant mb-xs uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] leading-none">description</span>
                        Description
                      </p>
                      <p className="text-body-md text-on-surface leading-relaxed">{viewGoal.description}</p>
                    </section>
                  )}

                  {/* Metric grid */}
                  <section className="grid grid-cols-2 gap-sm">
                    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-sm">
                      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] leading-none">flag</span>
                        Thrust Area
                      </p>
                      <p className="text-title-sm text-on-surface mt-1">{formatThrustArea(viewGoal.thrustArea)}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-sm">
                      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] leading-none">trending_up</span>
                        Measurement
                      </p>
                      <p className="text-title-sm text-on-surface mt-1">{UOM_TYPE_META[viewGoal.uomType as UoMType]?.label ?? viewGoal.uomType}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-sm">
                      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] leading-none">target</span>
                        Target
                      </p>
                      <p className="text-title-sm text-on-surface mt-1 tabular-nums">{formatTarget(viewGoal)}</p>
                    </div>
                    <div className="rounded-xl border border-outline-variant bg-surface-container-lowest p-sm">
                      <p className="text-label-sm text-on-surface-variant uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[13px] leading-none">monitoring</span>
                        Weightage
                      </p>
                      <p className="text-title-sm text-on-surface mt-1 tabular-nums">{weightage}%</p>
                      <div className="h-1.5 w-full rounded-full bg-outline-variant/50 overflow-hidden mt-1">
                        <div className={`h-full rounded-full ${accent.stripe}`} style={{ width: `${weightage}%` }} />
                      </div>
                    </div>
                  </section>

                  {/* Manager comment */}
                  {(viewGoal as any).managerComment && (
                    <section>
                      <p className="text-label-md text-on-surface-variant mb-xs uppercase tracking-wider flex items-center gap-1">
                        <span className="material-symbols-outlined text-[14px] leading-none">comment</span>
                        Manager Feedback
                      </p>
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-body-md text-rose-800 leading-relaxed">
                        {(viewGoal as any).managerComment}
                      </div>
                    </section>
                  )}

                  {/* Footer actions for pending goals */}
                  {col === "submitted" && sheet && (
                    <section className="pt-sm border-t border-outline-variant flex flex-wrap gap-sm">
                      <button
                        type="button"
                        onClick={() => { setEditTarget({ goal: viewGoal, sheet }); setViewGoal(null); }}
                        className="inline-flex items-center gap-1.5 px-md py-2 rounded-lg border border-outline-variant bg-surface-container-lowest text-on-surface text-title-sm hover:bg-surface-container-low"
                      >
                        <span className="material-symbols-outlined text-[16px]">edit</span>
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => { setApproveTarget({ sheet, user: owner }); setViewGoal(null); }}
                        className="inline-flex items-center gap-1.5 px-md py-2 rounded-lg bg-emerald-600 text-white text-title-sm shadow-level-1 border-t border-white/20 hover:opacity-90"
                      >
                        <span className="material-symbols-outlined text-[16px]">check_circle</span>
                        Approve sheet
                      </button>
                      <button
                        type="button"
                        onClick={() => { setRejectReason(""); setRejectTarget({ sheet, user: owner }); setViewGoal(null); }}
                        className="inline-flex items-center gap-1.5 px-md py-2 rounded-lg bg-rose-600 text-white text-title-sm shadow-level-1 border-t border-white/20 hover:opacity-90"
                      >
                        <span className="material-symbols-outlined text-[16px]">cancel</span>
                        Reject with feedback
                      </button>
                    </section>
                  )}
                </div>
              </>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Approve confirmation dialog */}
      {approveTarget && (
        <ConfirmDialog
          tone="success"
          icon="check_circle"
          title={`Approve ${approveTarget.user?.fullName ?? "this person"}'s goal sheet?`}
          message={`This will approve all ${approveTarget.sheet.goals?.length ?? 0} goal(s) on the sheet. The employee will be notified.`}
          confirmLabel="Approve sheet"
          loading={approveSheet.isPending}
          onCancel={() => setApproveTarget(null)}
          onConfirm={() => {
            const id = approveTarget.sheet.id;
            approveSheet.mutate(id, {
              onSuccess: () => {
                toast.success(`Approved ${approveTarget.user?.fullName ?? "sheet"}'s goals`);
                setApproveTarget(null);
              },
            });
          }}
        />
      )}

      {/* Reject feedback dialog */}
      {rejectTarget && (
        <RejectDialog
          employeeName={rejectTarget.user?.fullName ?? "this person"}
          goalCount={rejectTarget.sheet.goals?.length ?? 0}
          reason={rejectReason}
          onReasonChange={setRejectReason}
          loading={returnForRework.isPending}
          onCancel={() => { setRejectTarget(null); setRejectReason(""); }}
          onSubmit={() => {
            const trimmed = rejectReason.trim();
            if (trimmed.length < 20) {
              toast.error("Feedback must be at least 20 characters");
              return;
            }
            returnForRework.mutate(
              { sheetId: rejectTarget.sheet.id, reason: trimmed },
              {
                onSuccess: () => {
                  toast.success(`Returned to ${rejectTarget.user?.fullName ?? "employee"} for rework`);
                  setRejectTarget(null);
                  setRejectReason("");
                },
              }
            );
          }}
        />
      )}

      {/* Unlock goal sheet dialog (admin exception flow) */}
      {unlockTarget && (
        <UnlockSheetDialog
          employeeName={unlockTarget.user?.fullName ?? "this person"}
          goalCount={unlockTarget.sheet.goals?.length ?? 0}
          reason={unlockReason}
          onReasonChange={setUnlockReason}
          loading={unlockSheet.isPending}
          onCancel={() => { setUnlockTarget(null); setUnlockReason(""); }}
          onSubmit={() => {
            const trimmed = unlockReason.trim();
            if (trimmed.length < 20) {
              toast.error("Reason must be at least 20 characters");
              return;
            }
            unlockSheet.mutate(
              { sheetId: unlockTarget.sheet.id, reason: trimmed },
              {
                onSuccess: () => {
                  toast.success(`Unlocked ${unlockTarget.user?.fullName ?? "employee"}'s goal sheet — moved back to draft`);
                  setUnlockTarget(null);
                  setUnlockReason("");
                },
              }
            );
          }}
        />
      )}

      {/* Inline edit dialog */}
      {editTarget && (
        <InlineEditDialog
          goal={editTarget.goal}
          loading={inlineEdit.isPending}
          onCancel={() => setEditTarget(null)}
          onSubmit={async (patch) => {
            try {
              await inlineEdit.mutateAsync({
                sheetId: editTarget.sheet.id,
                goalId: editTarget.goal.id,
                patch,
              });
              toast.success("Goal updated");
              setEditTarget(null);
            } catch (e: any) {
              toast.error(e?.message ?? "Failed to update goal");
            }
          }}
        />
      )}
    </div>
  );
}

// ─── Dialog components ────────────────────────────────────────────────────────

interface ConfirmDialogProps {
  tone: 'success' | 'danger' | 'info';
  icon: string;
  title: string;
  message: string;
  confirmLabel: string;
  loading?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

function ConfirmDialog({ tone, icon, title, message, confirmLabel, loading, onCancel, onConfirm }: Readonly<ConfirmDialogProps>) {
  const toneCls = tone === 'success'
    ? { ring: 'bg-emerald-100 text-emerald-600', btn: 'bg-emerald-600 hover:bg-emerald-700' }
    : tone === 'danger'
    ? { ring: 'bg-rose-100 text-rose-600', btn: 'bg-rose-600 hover:bg-rose-700' }
    : { ring: 'bg-primary-container text-on-primary-container', btn: 'bg-primary hover:opacity-90' };
  return (
    <button
      type='button'
      onClick={onCancel}
      aria-label='Close dialog'
      className='fixed inset-0 z-50 bg-scrim/40 backdrop-blur-sm flex items-center justify-center p-md animate-in fade-in'
    >
      <div
        role='dialog'
        aria-modal='true'
        onClick={(e) => e.stopPropagation()}
        className='w-full max-w-md bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-level-3 overflow-hidden animate-in zoom-in-95'
      >
        <div className='px-lg pt-lg pb-md flex items-start gap-md'>
          <span className={`inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0 ${toneCls.ring}`}>
            <span className='material-symbols-outlined text-[24px]'>{icon}</span>
          </span>
          <div className='min-w-0 flex-1'>
            <h3 className='text-title-lg text-on-surface mb-1'>{title}</h3>
            <p className='text-body-md text-on-surface-variant leading-relaxed'>{message}</p>
          </div>
        </div>
        <div className='px-lg py-md bg-surface-container/40 flex justify-end gap-sm'>
          <button
            type='button'
            onClick={onCancel}
            disabled={loading}
            className='px-md py-2 rounded-lg text-title-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onConfirm}
            disabled={loading}
            className={`px-md py-2 rounded-lg text-title-sm text-white shadow-level-1 border-t border-white/20 disabled:opacity-50 inline-flex items-center gap-1.5 ${toneCls.btn}`}
          >
            {loading && <span className='material-symbols-outlined animate-spin text-[16px]'>progress_activity</span>}
            {confirmLabel}
          </button>
        </div>
      </div>
    </button>
  );
}

interface RejectDialogProps {
  employeeName: string;
  goalCount: number;
  reason: string;
  onReasonChange: (v: string) => void;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function RejectDialog({ employeeName, goalCount, reason, onReasonChange, loading, onCancel, onSubmit }: Readonly<RejectDialogProps>) {
  const trimmed = reason.trim();
  const valid = trimmed.length >= 20;
  return (
    <button
      type='button'
      onClick={onCancel}
      aria-label='Close dialog'
      className='fixed inset-0 z-50 bg-scrim/40 backdrop-blur-sm flex items-center justify-center p-md animate-in fade-in'
    >
      <div
        role='dialog'
        aria-modal='true'
        onClick={(e) => e.stopPropagation()}
        className='w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-level-3 overflow-hidden animate-in zoom-in-95'
      >
        <div className='px-lg pt-lg pb-md flex items-start gap-md'>
          <span className='inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0 bg-rose-100 text-rose-600'>
            <span className='material-symbols-outlined text-[24px]'>cancel</span>
          </span>
          <div className='min-w-0 flex-1'>
            <h3 className='text-title-lg text-on-surface mb-1'>Return goal sheet for rework</h3>
            <p className='text-body-md text-on-surface-variant leading-relaxed'>
              Send {employeeName}&apos;s {goalCount} goal(s) back with feedback so they can revise and resubmit.
            </p>
          </div>
        </div>
        <div className='px-lg pb-md'>
          <label htmlFor='reject-reason' className='text-label-md text-on-surface-variant mb-1 block uppercase tracking-wider'>
            Feedback <span className='text-rose-600'>*</span>
          </label>
          <textarea
            id='reject-reason'
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={4}
            placeholder='Explain what needs to change (minimum 20 characters)...'
            className='w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none resize-none'
            autoFocus
          />
          <div className='flex justify-between mt-1'>
            <p className='text-label-sm text-on-surface-variant'>
              {trimmed.length === 0 ? 'Required' : valid ? '✓ Looks good' : `${20 - trimmed.length} more character(s)`}
            </p>
            <p className='text-label-sm text-on-surface-variant tabular-nums'>{reason.length}</p>
          </div>
        </div>
        <div className='px-lg py-md bg-surface-container/40 flex justify-end gap-sm'>
          <button
            type='button'
            onClick={onCancel}
            disabled={loading}
            className='px-md py-2 rounded-lg text-title-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onSubmit}
            disabled={loading || !valid}
            className='px-md py-2 rounded-lg text-title-sm text-white shadow-level-1 border-t border-white/20 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5'
          >
            {loading && <span className='material-symbols-outlined animate-spin text-[16px]'>progress_activity</span>}
            Return for rework
          </button>
        </div>
      </div>
    </button>
  );
}

interface UnlockSheetDialogProps {
  employeeName: string;
  goalCount: number;
  reason: string;
  onReasonChange: (v: string) => void;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: () => void;
}

function UnlockSheetDialog({ employeeName, goalCount, reason, onReasonChange, loading, onCancel, onSubmit }: Readonly<UnlockSheetDialogProps>) {
  const trimmed = reason.trim();
  const valid = trimmed.length >= 20;
  return (
    <button
      type='button'
      onClick={onCancel}
      aria-label='Close dialog'
      className='fixed inset-0 z-50 bg-scrim/40 backdrop-blur-sm flex items-center justify-center p-md animate-in fade-in'
    >
      <div
        role='dialog'
        aria-modal='true'
        onClick={(e) => e.stopPropagation()}
        className='w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-level-3 overflow-hidden animate-in zoom-in-95'
      >
        <div className='px-lg pt-lg pb-md flex items-start gap-md'>
          <span className='inline-flex items-center justify-center w-11 h-11 rounded-full shrink-0 bg-amber-100 text-amber-700'>
            <span className='material-symbols-outlined text-[24px]'>lock_open_right</span>
          </span>
          <div className='min-w-0 flex-1'>
            <h3 className='text-title-lg text-on-surface mb-1'>Unlock goal sheet</h3>
            <p className='text-body-md text-on-surface-variant leading-relaxed'>
              This will move {employeeName}&apos;s {goalCount} goal(s) back to <strong>Draft</strong> so they can edit and resubmit. The action is logged with your reason.
            </p>
          </div>
        </div>
        <div className='px-lg pb-md'>
          <label htmlFor='unlock-reason' className='text-label-md text-on-surface-variant mb-1 block uppercase tracking-wider'>
            Reason for unlock <span className='text-amber-700'>*</span>
          </label>
          <textarea
            id='unlock-reason'
            value={reason}
            onChange={(e) => onReasonChange(e.target.value)}
            rows={4}
            placeholder='Explain why this sheet is being unlocked (minimum 20 characters)...'
            className='w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none resize-none'
            autoFocus
          />
          <div className='flex justify-between mt-1'>
            <p className='text-label-sm text-on-surface-variant'>
              {trimmed.length === 0 ? 'Required' : valid ? '✓ Looks good' : `${20 - trimmed.length} more character(s)`}
            </p>
            <p className='text-label-sm text-on-surface-variant tabular-nums'>{reason.length}</p>
          </div>
        </div>
        <div className='px-lg py-md bg-surface-container/40 flex justify-end gap-sm'>
          <button
            type='button'
            onClick={onCancel}
            disabled={loading}
            className='px-md py-2 rounded-lg text-title-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={onSubmit}
            disabled={loading || !valid}
            className='px-md py-2 rounded-lg text-title-sm text-white shadow-level-1 border-t border-white/20 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 inline-flex items-center gap-1.5'
          >
            {loading && <span className='material-symbols-outlined animate-spin text-[16px]'>progress_activity</span>}
            Unlock goals
          </button>
        </div>
      </div>
    </button>
  );
}

interface InlineEditDialogProps {
  goal: any;
  loading?: boolean;
  onCancel: () => void;
  onSubmit: (patch: {
    targetValue?: number | null;
    targetDate?: string | null;
    weightage?: number;
    changeReason: string;
  }) => void;
}

function InlineEditDialog({ goal, loading, onCancel, onSubmit }: Readonly<InlineEditDialogProps>) {
  const isTimeline = goal.uomType === 'TIMELINE';
  const [targetValue, setTargetValue] = useState<string>(goal.targetValue != null ? String(goal.targetValue) : '');
  const [targetDate, setTargetDate] = useState<string>(goal.targetDate ? goal.targetDate.slice(0, 10) : '');
  const [weightage, setWeightage] = useState<string>(String(goal.weightage ?? ''));
  const [reason, setReason] = useState('');
  const reasonValid = reason.trim().length >= 5;
  const weightageNum = Number(weightage);
  const weightageValid = !Number.isNaN(weightageNum) && weightageNum >= 0 && weightageNum <= 100;

  return (
    <button
      type='button'
      onClick={onCancel}
      aria-label='Close dialog'
      className='fixed inset-0 z-50 bg-scrim/40 backdrop-blur-sm flex items-center justify-center p-md animate-in fade-in'
    >
      <div
        role='dialog'
        aria-modal='true'
        onClick={(e) => e.stopPropagation()}
        className='w-full max-w-lg bg-surface-container-lowest rounded-2xl border border-outline-variant shadow-level-3 overflow-hidden animate-in zoom-in-95'
      >
        <div className='px-lg pt-lg pb-md border-b border-outline-variant'>
          <div className='flex items-start gap-md'>
            <span className='inline-flex items-center justify-center w-10 h-10 rounded-lg bg-primary-container text-on-primary-container shrink-0'>
              <span className='material-symbols-outlined text-[20px]'>edit</span>
            </span>
            <div className='min-w-0 flex-1'>
              <h3 className='text-title-lg text-on-surface mb-1 truncate'>Edit pending goal</h3>
              <p className='text-body-md text-on-surface-variant truncate'>{goal.title}</p>
            </div>
          </div>
        </div>
        <div className='px-lg py-md space-y-md'>
          {isTimeline ? (
            <div>
              <label htmlFor='edit-target-date' className='text-label-md text-on-surface-variant mb-1 block uppercase tracking-wider'>Target date</label>
              <input
                id='edit-target-date'
                type='date'
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                className='w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none'
              />
            </div>
          ) : (
            <div>
              <label htmlFor='edit-target-value' className='text-label-md text-on-surface-variant mb-1 block uppercase tracking-wider'>Target value</label>
              <input
                id='edit-target-value'
                type='number'
                step='any'
                value={targetValue}
                onChange={(e) => setTargetValue(e.target.value)}
                className='w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none tabular-nums'
              />
            </div>
          )}
          <div>
            <label htmlFor='edit-weightage' className='text-label-md text-on-surface-variant mb-1 block uppercase tracking-wider'>Weightage (%)</label>
            <input
              id='edit-weightage'
              type='number'
              min={0}
              max={100}
              step='1'
              value={weightage}
              onChange={(e) => setWeightage(e.target.value)}
              className='w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none tabular-nums'
            />
            {!weightageValid && (
              <p className='text-label-sm text-rose-600 mt-1'>Must be between 0 and 100</p>
            )}
          </div>
          <div>
            <label htmlFor='edit-reason' className='text-label-md text-on-surface-variant mb-1 block uppercase tracking-wider'>
              Reason for change <span className='text-rose-600'>*</span>
            </label>
            <textarea
              id='edit-reason'
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder='Why are you editing this goal?'
              className='w-full px-3 py-2 rounded-lg bg-surface-container-lowest border border-outline-variant text-body-md text-on-surface focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none resize-none'
            />
          </div>
        </div>
        <div className='px-lg py-md bg-surface-container/40 flex justify-end gap-sm'>
          <button
            type='button'
            onClick={onCancel}
            disabled={loading}
            className='px-md py-2 rounded-lg text-title-sm text-on-surface hover:bg-surface-container-low disabled:opacity-50'
          >
            Cancel
          </button>
          <button
            type='button'
            onClick={() => {
              if (!reasonValid || !weightageValid) return;
              const patch: any = { changeReason: reason.trim(), weightage: weightageNum };
              if (isTimeline) {
                patch.targetDate = targetDate || null;
              } else {
                patch.targetValue = targetValue === '' ? null : Number(targetValue);
              }
              onSubmit(patch);
            }}
            disabled={loading || !reasonValid || !weightageValid}
            className='px-md py-2 rounded-lg text-title-sm text-on-primary shadow-level-1 border-t border-white/20 bg-primary hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-1.5'
          >
            {loading && <span className='material-symbols-outlined animate-spin text-[16px]'>progress_activity</span>}
            Save changes
          </button>
        </div>
      </div>
    </button>
  );
}
