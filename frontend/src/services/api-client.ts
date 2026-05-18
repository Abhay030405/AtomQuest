const BASE_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";
const AUTH_STORAGE_KEY = "atomquest-auth";

function getAuthToken(): string | null {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { state?: { token?: string | null } };
    return parsed.state?.token ?? null;
  } catch {
    return null;
  }
}

function clearAuthAndRedirect() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // ignore
  }
  if (typeof window !== "undefined" && !window.location.pathname.startsWith("/login")) {
    window.location.assign("/login");
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const isAuthEndpoint = path.startsWith("/v1/auth/");
  if (!token && !isAuthEndpoint) {
    // No token at all — log it and let backend respond 401
    console.warn(`[apiClient] No auth token for ${path}`);
  }
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: { ...headers, ...(init?.headers as Record<string, string> | undefined) },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await res.json() : await res.text();

  if (res.status === 401 && !isAuthEndpoint) {
    clearAuthAndRedirect();
    throw new Error("Your session has expired. Please log in again.");
  }

  if (!res.ok) {
    let message: string | undefined;
    if (isJson && body && typeof body === "object") {
      const b = body as {
        error?: { message?: string; field?: string; code?: string } | string;
        message?: string;
        detail?: unknown;
      };
      if (typeof b.error === "object" && b.error?.message) {
        message = b.error.message;
        if (b.error.field) message = `${message} (${b.error.field})`;
      } else if (typeof b.error === "string") message = b.error;
      else if (b.message) message = b.message;
      else if (typeof b.detail === "string") message = b.detail;
      else if (Array.isArray(b.detail) && b.detail.length > 0) {
        // FastAPI validation errors
        const first = b.detail[0] as { msg?: string; loc?: unknown[] };
        if (first.msg) {
          const loc = Array.isArray(first.loc) ? first.loc.join(".") : "";
          message = loc ? `${loc}: ${first.msg}` : first.msg;
        }
      }
      // Surface the raw error body in console for debugging — invaluable for
      // tracking down why the backend rejected the request when the toast
      // message is generic ("Validation error").
      if (res.status >= 400) {
        console.error(`[apiClient] ${res.status} ${path}`, body);
      }
    }
    throw new Error(message ?? res.statusText ?? `API error ${res.status}`);
  }
  return body as T;
}

export const apiClient = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "POST", body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PUT", body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
