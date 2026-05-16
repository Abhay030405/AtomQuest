import { useQuery } from "@tanstack/react-query";
import { adminService } from "@/services/admin.service";
import type { AuditAction } from "@/types/audit.types";

export interface AuditLogFilters {
  page?: number;
  pageSize?: number;
  actorId?: string;
  tableName?: string;
  action?: AuditAction;
  fromDate?: string;
  toDate?: string;
}

export function useAuditLog(filters: AuditLogFilters = {}) {
  const { page = 1, pageSize = 20, ...rest } = filters;

  const query = useQuery({
    queryKey: ["audit-log", page, pageSize, rest],
    queryFn: () => adminService.getAuditLog({ page, pageSize, ...rest }),
  });

  return {
    logs: query.data?.items ?? [],
    total: query.data?.total ?? 0,
    totalPages: query.data?.totalPages ?? 0,
    page: query.data?.page ?? page,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
  };
}
