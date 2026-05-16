import type { APIResponse } from "@/types/api.types";

function randomDelay(): Promise<void> {
  const ms = 300 + Math.random() * 200;
  return new Promise((r) => setTimeout(r, ms));
}

export async function mockRequest<T>(fn: () => T): Promise<APIResponse<T>> {
  await randomDelay();
  try {
    const data = fn();
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { success: false, data: undefined as T, error: { code: "INTERNAL", message } };
  }
}

export async function mockRequestOrThrow<T>(fn: () => T): Promise<T> {
  const result = await mockRequest(fn);
  if (!result.success) throw new Error(result.error?.message ?? "Request failed");
  return result.data;
}
