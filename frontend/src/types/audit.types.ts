import type { UserRole } from "./user.types";

export const AuditAction = {
  INSERT: "INSERT",
  UPDATE: "UPDATE",
  DELETE: "DELETE",
} as const;
export type AuditAction = (typeof AuditAction)[keyof typeof AuditAction];

// ─── Interfaces ───────────────────────────────────────────────────────────────

export interface AuditLog {
  id: string;
  tableName: string;
  recordId: string;
  action: AuditAction;
  fieldName?: string;
  oldValue?: string;
  newValue?: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  changedAt: string;
  ipAddress?: string;
}
