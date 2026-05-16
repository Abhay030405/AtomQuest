import { useState, useMemo } from "react";
import type { ReactNode } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface Props<T> {
  data: T[];
  columns: Column<T>[];
  isLoading?: boolean;
  getRowKey: (row: T) => string;
  emptyState?: ReactNode;
  onRowClick?: (row: T) => void;
  pageSize?: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function primitiveString(val: unknown): string {
  if (typeof val === "string") return val;
  if (typeof val === "number" || typeof val === "boolean") return String(val);
  return "";
}

function SortIcon({
  colKey,
  sortKey,
  sortDir,
}: Readonly<{
  colKey: string;
  sortKey: string | null;
  sortDir: "asc" | "desc";
}>) {
  if (sortKey !== colKey)
    return <ChevronsUpDown className="h-3 w-3 text-muted-foreground/40" />;
  if (sortDir === "asc") return <ChevronUp className="h-3 w-3" />;
  return <ChevronDown className="h-3 w-3" />;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function DataTable<T>({
  data,
  columns,
  isLoading,
  getRowKey,
  emptyState,
  onRowClick,
  pageSize = 10,
}: Readonly<Props<T>>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const aVal = primitiveString((a as Record<string, unknown>)[sortKey]);
      const bVal = primitiveString((b as Record<string, unknown>)[sortKey]);
      const cmp = aVal.localeCompare(bVal, undefined, { numeric: true });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const sliced = sorted.slice((safePage - 1) * pageSize, safePage * pageSize);
  const start = sorted.length === 0 ? 0 : (safePage - 1) * pageSize + 1;
  const end = Math.min(safePage * pageSize, sorted.length);

  // Stable keys for skeleton rows — never use array index directly
  const skeletonKeys = Array.from(
    { length: Math.min(pageSize, 5) },
    (_, i) => `skeleton-row-${i}`
  );

  function renderBody() {
    if (isLoading) {
      return skeletonKeys.map((key) => (
        <TableRow key={key}>
          {columns.map((col) => (
            <TableCell key={col.key} className={col.className}>
              <Skeleton className="h-4 w-full max-w-[180px]" />
            </TableCell>
          ))}
        </TableRow>
      ));
    }

    if (sliced.length === 0) {
      return (
        <TableRow>
          <TableCell colSpan={columns.length} className="p-0">
            {emptyState ?? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                No records found.
              </div>
            )}
          </TableCell>
        </TableRow>
      );
    }

    return sliced.map((row) => (
      <TableRow
        key={getRowKey(row)}
        className={cn(
          "transition-colors",
          onRowClick && "cursor-pointer hover:bg-muted/40"
        )}
        onClick={() => onRowClick?.(row)}
      >
        {columns.map((col) => (
          <TableCell key={col.key} className={cn("text-sm", col.className)}>
            {col.cell(row)}
          </TableCell>
        ))}
      </TableRow>
    ));
  }

  return (
    <div className="space-y-3">
      <div className="rounded-lg border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 hover:bg-muted/40">
              {columns.map((col) => (
                <TableHead
                  key={col.key}
                  className={cn(
                    "text-xs font-semibold h-9",
                    col.className,
                    col.sortable &&
                      "cursor-pointer select-none hover:text-foreground"
                  )}
                  onClick={col.sortable ? () => handleSort(col.key) : undefined}
                >
                  <div className="flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <SortIcon
                        colKey={col.key}
                        sortKey={sortKey}
                        sortDir={sortDir}
                      />
                    )}
                  </div>
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>{renderBody()}</TableBody>
        </Table>
      </div>

      {/* Pagination — only shown when there's more than one page */}
      {!isLoading && sorted.length > pageSize && (
        <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
          <span>
            Showing {start}–{end} of {sorted.length} results
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              Previous
            </Button>
            <span className="px-2 tabular-nums">
              {safePage} / {totalPages}
            </span>
            <Button
              variant="outline"
              size="sm"
              className="h-7 px-2.5 text-xs"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
