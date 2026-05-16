import { useState, useMemo } from "react";
import { Download, Search, X } from "lucide-react";
import { DataTable } from "./DataTable";
import { EmptyState } from "./EmptyState";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatDate, formatDateTime } from "@/utils/date.util";
import { getRoleDisplayName } from "@/utils/permission.util";
import { AuditAction } from "@/types/audit.types";
import type { AuditLog } from "@/types/audit.types";
import type { AuditAction as AuditActionType } from "@/types/audit.types";
import { cn } from "@/lib/utils";

// ─── Action badge ─────────────────────────────────────────────────────────────

function ActionBadge({ action }: Readonly<{ action: AuditActionType }>) {
  const styles: Record<AuditActionType, string> = {
    [AuditAction.INSERT]: "bg-emerald-100 text-emerald-700 border-emerald-200",
    [AuditAction.UPDATE]: "bg-amber-100 text-amber-700 border-amber-200",
    [AuditAction.DELETE]: "bg-red-100 text-red-700 border-red-200",
  };
  return (
    <Badge className={cn("border text-[10px] font-semibold px-1.5", styles[action])}>
      {action}
    </Badge>
  );
}

// ─── Old → New value diff ─────────────────────────────────────────────────────

interface ValueDiffProps {
  readonly oldValue?: string;
  readonly newValue?: string;
}

function ValueDiff({ oldValue, newValue }: ValueDiffProps) {
  if (oldValue === undefined && newValue === undefined) return <span>—</span>;
  const showArrow = oldValue !== undefined && newValue !== undefined;
  return (
    <span className="flex items-baseline gap-1 text-xs flex-wrap">
      {oldValue === undefined ? null : (
        <span className="line-through text-muted-foreground/70 max-w-[120px] truncate">
          {oldValue}
        </span>
      )}
      {showArrow ? <span className="text-muted-foreground">→</span> : null}
      {newValue === undefined ? null : (
        <span className="font-medium text-foreground max-w-[120px] truncate">
          {newValue}
        </span>
      )}
    </span>
  );
}

// ─── Action filter popover ────────────────────────────────────────────────────

const ALL_ACTIONS = Object.values(AuditAction) as AuditActionType[];

interface ActionFilterProps {
  readonly selected: AuditActionType[];
  readonly onChange: (actions: AuditActionType[]) => void;
}

function ActionFilter({ selected, onChange }: ActionFilterProps) {
  const toggle = (action: AuditActionType) => {
    if (selected.includes(action)) {
      onChange(selected.filter((a) => a !== action));
    } else {
      onChange([...selected, action]);
    }
  };

  const label =
    selected.length === 0 || selected.length === ALL_ACTIONS.length
      ? "All actions"
      : selected.join(", ");

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
          {label}
          {selected.length > 0 && selected.length < ALL_ACTIONS.length && (
            <Badge className="h-4 px-1 text-[10px] bg-indigo-100 text-indigo-700 border-0">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-40 p-2" align="start">
        <p className="text-[11px] font-medium text-muted-foreground mb-2 px-1">
          Filter by action
        </p>
        <div className="space-y-1">
          {ALL_ACTIONS.map((action) => (
            <button
              key={action}
              onClick={() => toggle(action)}
              className={cn(
                "w-full flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-colors",
                selected.includes(action)
                  ? "bg-indigo-50 text-indigo-700 font-medium"
                  : "hover:bg-muted text-foreground"
              )}
            >
              <span
                className={cn(
                  "h-2.5 w-2.5 rounded-full shrink-0",
                  action === AuditAction.INSERT && "bg-emerald-500",
                  action === AuditAction.UPDATE && "bg-amber-500",
                  action === AuditAction.DELETE && "bg-red-500"
                )}
              />
              {action}
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full mt-2 h-6 text-[11px] text-muted-foreground"
            onClick={() => onChange([])}
          >
            Clear filter
          </Button>
        )}
      </PopoverContent>
    </Popover>
  );
}

// ─── CSV export ───────────────────────────────────────────────────────────────

function exportCsv(logs: AuditLog[]) {
  const headers = [
    "Timestamp",
    "Actor",
    "Role",
    "Action",
    "Table",
    "Field",
    "Old Value",
    "New Value",
  ];

  const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;

  const rows = logs.map((log) =>
    [
      formatDateTime(log.changedAt),
      log.actorName,
      log.actorRole,
      log.action,
      log.tableName,
      log.fieldName ?? "",
      log.oldValue ?? "",
      log.newValue ?? "",
    ]
      .map(escape)
      .join(",")
  );

  const csv = [headers.join(","), ...rows].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);

  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `audit-log-${formatDate(new Date().toISOString(), "yyyy-MM-dd")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  {
    key: "changedAt",
    header: "Timestamp",
    sortable: true,
    cell: (r: AuditLog) => (
      <span className="text-xs tabular-nums whitespace-nowrap text-muted-foreground">
        {formatDateTime(r.changedAt)}
      </span>
    ),
  },
  {
    key: "actorName",
    header: "Actor",
    sortable: true,
    cell: (r: AuditLog) => (
      <span className="text-xs font-medium whitespace-nowrap">{r.actorName}</span>
    ),
  },
  {
    key: "actorRole",
    header: "Role",
    cell: (r: AuditLog) => (
      <span className="text-xs text-muted-foreground">
        {getRoleDisplayName(r.actorRole)}
      </span>
    ),
  },
  {
    key: "action",
    header: "Action",
    sortable: true,
    cell: (r: AuditLog) => <ActionBadge action={r.action} />,
  },
  {
    key: "tableName",
    header: "Table",
    sortable: true,
    cell: (r: AuditLog) => (
      <span className="font-mono text-[11px] text-muted-foreground">
        {r.tableName}
      </span>
    ),
  },
  {
    key: "fieldName",
    header: "Field",
    cell: (r: AuditLog) => (
      <span className="font-mono text-[11px]">{r.fieldName ?? "—"}</span>
    ),
  },
  {
    key: "change",
    header: "Old → New",
    cell: (r: AuditLog) => (
      <ValueDiff oldValue={r.oldValue} newValue={r.newValue} />
    ),
  },
];

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  logs: AuditLog[];
  isLoading?: boolean;
}

export function AuditLogTable({ logs, isLoading }: Readonly<Props>) {
  const [actorSearch, setActorSearch] = useState("");
  const [actionFilter, setActionFilter] = useState<AuditActionType[]>([]);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [postLockOnly, setPostLockOnly] = useState(false);

  // Post-lock date: FY2026 cycle locked on Apr 1 2026
  const POST_LOCK_DATE = "2026-04-01T00:00:00.000Z";

  const filtered = useMemo(() => {
    return logs.filter((log) => {
      if (
        actorSearch &&
        !log.actorName.toLowerCase().includes(actorSearch.toLowerCase())
      )
        return false;

      if (actionFilter.length > 0 && !actionFilter.includes(log.action))
        return false;

      if (fromDate && log.changedAt < fromDate) return false;

      if (toDate) {
        // Include the entire toDate day
        const toEnd = toDate + "T23:59:59.999Z";
        if (log.changedAt > toEnd) return false;
      }

      if (postLockOnly && log.changedAt < POST_LOCK_DATE) return false;

      return true;
    });
  }, [logs, actorSearch, actionFilter, fromDate, toDate, postLockOnly]);

  const hasActiveFilter =
    actorSearch || actionFilter.length > 0 || fromDate || toDate || postLockOnly;

  const clearAll = () => {
    setActorSearch("");
    setActionFilter([]);
    setFromDate("");
    setToDate("");
    setPostLockOnly(false);
  };

  return (
    <div className="space-y-3">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Actor search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder="Search actor…"
            value={actorSearch}
            onChange={(e) => setActorSearch(e.target.value)}
            className="h-8 pl-8 text-xs w-44"
          />
        </div>

        {/* Date from */}
        <Input
          type="date"
          title="From date"
          value={fromDate}
          onChange={(e) => setFromDate(e.target.value)}
          className="h-8 text-xs w-36"
        />

        {/* Date to */}
        <Input
          type="date"
          title="To date"
          value={toDate}
          onChange={(e) => setToDate(e.target.value)}
          className="h-8 text-xs w-36"
        />

        {/* Action multi-select */}
        <ActionFilter selected={actionFilter} onChange={setActionFilter} />

        {/* Post-lock toggle */}
        <div className="flex items-center gap-1.5">
          <Switch
            id="post-lock"
            checked={postLockOnly}
            onCheckedChange={setPostLockOnly}
            className="h-4 w-7 data-[state=checked]:bg-indigo-600"
          />
          <Label htmlFor="post-lock" className="text-xs cursor-pointer select-none">
            Post-lock only
          </Label>
        </div>

        {/* Clear all */}
        {hasActiveFilter && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs text-muted-foreground gap-1"
            onClick={clearAll}
          >
            <X className="h-3 w-3" />
            Clear
          </Button>
        )}

        {/* Spacer + CSV export */}
        <div className="ml-auto">
          <Button
            variant="outline"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={() => exportCsv(filtered)}
            disabled={filtered.length === 0}
          >
            <Download className="h-3.5 w-3.5" />
            Export CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <DataTable
        data={filtered}
        columns={COLUMNS}
        isLoading={isLoading}
        getRowKey={(r) => r.id}
        pageSize={20}
        emptyState={
          <EmptyState variant="no-audit-logs" className="py-10" />
        }
      />
    </div>
  );
}
