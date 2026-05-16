// ─── Generic API wrapper ──────────────────────────────────────────────────────

export interface APIError {
  code: string;
  message: string;
  field?: string;
}

export interface APIMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface APIResponse<T = unknown> {
  success: boolean;
  data: T;
  error?: APIError;
  meta?: APIMeta;
}

// ─── Paginated list wrapper ───────────────────────────────────────────────────

export interface PaginatedResponse<T = unknown> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
