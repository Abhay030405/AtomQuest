import { useState, useMemo } from "react";
import { useAdminAuditLog } from "@/hooks/useAdmin";
import { cn } from "@/lib/utils";

const ACTION_CHIP: Record<string, string> = {
  INSERT: "bg-tertiary-container/20 text-tertiary",
  UPDATE: "bg-surface-variant text-on-surface-variant",
  DELETE: "bg-error-container/50 text-on-error-container",
};

export default function AuditTrailPage() {
  const { data: auditPage, isLoading } = useAdminAuditLog({ pageSize: 500 });
  const logs = auditPage?.items ?? [];

  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");

  const filtered = useMemo(() => {
    return logs.filter((log: any) => {
      if (search && !log.actorName.toLowerCase().includes(search.toLowerCase())) return false;
      if (actionFilter && log.action !== actionFilter) return false;
      return true;
    });
  }, [logs, search, actionFilter]);

  return (
    <div className="p-margin-mobile md:p-margin-desktop max-w-[1440px] mx-auto space-y-lg">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-md border-b border-outline-variant pb-md">
        <div>
          <h2 className="text-headline-lg text-on-surface">Audit Trail</h2>
          <p className="text-body-lg text-on-surface-variant mt-xs">System-wide change log — every insert, update, and delete.</p>
        </div>
        <button className="bg-surface-container-lowest border border-outline-variant text-on-surface text-label-md px-md py-sm rounded-lg shadow-level-1 hover:bg-surface-container-low transition-colors flex items-center gap-xs self-start md:self-auto">
          <span className="material-symbols-outlined text-[18px]">download</span>
          Export Log
        </button>
      </div>

      {/* Filters */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-md shadow-level-1 flex flex-col md:flex-row gap-md items-center justify-between">
        <div className="flex-1 w-full md:w-auto relative">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline">search</span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by user name..."
            className="w-full pl-xl pr-sm py-sm bg-surface-container-low border border-outline-variant rounded-md text-body-md focus:border-primary focus:ring-1 focus:ring-primary/20 focus:outline-none"
          />
        </div>
        <div className="flex items-center gap-sm w-full md:w-auto">
          <div className="relative flex items-center">
            <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-[18px]">filter_list</span>
            <select
              value={actionFilter}
              onChange={(e) => setActionFilter(e.target.value)}
              className="pl-xl pr-lg py-sm bg-surface-container-lowest border border-outline-variant text-on-surface text-body-md rounded-md focus:border-primary focus:outline-none appearance-none"
            >
              <option value="">All Actions</option>
              <option value="INSERT">INSERT</option>
              <option value="UPDATE">UPDATE</option>
              <option value="DELETE">DELETE</option>
            </select>
          </div>
          {(search || actionFilter) && (
            <button
              onClick={() => { setSearch(""); setActionFilter(""); }}
              className="text-on-surface-variant hover:text-on-surface text-body-md flex items-center gap-xs px-sm py-sm rounded border border-outline-variant bg-surface-container-lowest hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-surface-container-lowest border border-outline-variant rounded-xl shadow-level-1 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container text-on-surface-variant text-label-md uppercase tracking-wider border-b border-outline-variant">
                <th className="p-md font-medium min-w-[160px]">Timestamp</th>
                <th className="p-md font-medium min-w-[200px]">User</th>
                <th className="p-md font-medium min-w-[150px]">Action</th>
                <th className="p-md font-medium min-w-[200px]">Details</th>
                <th className="p-md font-medium min-w-[120px] hidden lg:table-cell">IP Address</th>
              </tr>
            </thead>
            <tbody className="text-body-md text-on-surface divide-y divide-outline-variant/50">
              {isLoading ? (
                <>
                  {[1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}>
                      <td colSpan={5} className="p-md">
                        <div className="h-10 bg-surface-container-low rounded-lg animate-pulse" />
                      </td>
                    </tr>
                  ))}
                </>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-xl text-center">
                    <span className="material-symbols-outlined text-[48px] text-on-surface-variant/40">history</span>
                    <p className="text-body-md text-on-surface-variant mt-md">No audit log entries found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((log: any) => {
                  const initials = (log.actorName ?? "??").split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase();
                  const actionCls = ACTION_CHIP[log.action] ?? ACTION_CHIP["UPDATE"];
                  const ts = new Date(log.changedAt);
                  return (
                    <tr key={log.id} className="hover:bg-surface-bright transition-colors">
                      <td className="p-md whitespace-nowrap text-on-surface-variant font-code text-[12px]">
                        {ts.toLocaleString("en-US", {
                          year: "numeric", month: "2-digit", day: "2-digit",
                          hour: "2-digit", minute: "2-digit", second: "2-digit",
                          hour12: false,
                        })}
                      </td>
                      <td className="p-md">
                        <div className="flex items-center gap-sm">
                          <div className="w-6 h-6 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[10px] font-medium">
                            {initials}
                          </div>
                          <span className="text-on-surface">{log.actorName}</span>
                        </div>
                      </td>
                      <td className="p-md">
                        <span className={cn("px-2 py-1 rounded font-code text-[11px]", actionCls)}>
                          {log.action}
                        </span>
                      </td>
                      <td className="p-md">
                        <div className="text-body-md text-on-surface">
                          <span className="font-code text-[11px] bg-surface-container px-xs rounded mr-xs">{log.tableName}</span>
                          {log.fieldName && (
                            <span className="text-on-surface-variant">
                              {log.fieldName}
                              {log.oldValue && log.newValue && (
                                <>: <span className="line-through text-outline">{log.oldValue}</span> → <span className="font-medium">{log.newValue}</span></>
                              )}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="p-md font-code text-[12px] text-on-surface-variant hidden lg:table-cell">
                        {log.ipAddress ?? "—"}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        {!isLoading && (
          <div className="p-sm px-md border-t border-outline-variant flex justify-between items-center bg-surface-bright">
            <span className="text-label-md text-on-surface-variant">Showing {filtered.length} of {logs.length} entries</span>
            <div className="flex gap-xs">
              <button className="p-xs text-outline hover:text-on-surface disabled:opacity-50" disabled>
                <span className="material-symbols-outlined text-[20px]">chevron_left</span>
              </button>
              <button className="p-xs text-on-surface hover:text-primary">
                <span className="material-symbols-outlined text-[20px]">chevron_right</span>
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
