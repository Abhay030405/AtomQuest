import { AuditAction } from "@/types/audit.types";
import { UserRole } from "@/types/user.types";
import type { AuditLog } from "@/types/audit.types";
import { GOAL_IDS } from "./mockGoals";

// ─── Audit log entries ────────────────────────────────────────────────────────

export const mockAuditLogs: AuditLog[] = [
  // 1. Rahul creates Goal 1
  {
    id: "al-001",
    tableName: "goals",
    recordId: GOAL_IDS.RAHUL_SALES_REVENUE,
    action: AuditAction.INSERT,
    actorId: "u-rahul-verma",
    actorName: "Rahul Verma",
    actorRole: UserRole.EMPLOYEE,
    changedAt: "2025-04-10T09:00:00.000Z",
  },

  // 2. Rahul creates Goal 2
  {
    id: "al-002",
    tableName: "goals",
    recordId: GOAL_IDS.RAHUL_CUSTOMER_TAT,
    action: AuditAction.INSERT,
    actorId: "u-rahul-verma",
    actorName: "Rahul Verma",
    actorRole: UserRole.EMPLOYEE,
    changedAt: "2025-04-10T09:15:00.000Z",
  },

  // 3. Vikram edits Goal 1 target value (45 → 50 Lakhs)
  {
    id: "al-003",
    tableName: "goals",
    recordId: GOAL_IDS.RAHUL_SALES_REVENUE,
    action: AuditAction.UPDATE,
    fieldName: "targetValue",
    oldValue: "45",
    newValue: "50",
    actorId: "u-vikram-nair",
    actorName: "Vikram Nair",
    actorRole: UserRole.MANAGER,
    changedAt: "2025-04-14T11:30:00.000Z",
  },

  // 4. Vikram edits Goal 1 description
  {
    id: "al-004",
    tableName: "goals",
    recordId: GOAL_IDS.RAHUL_SALES_REVENUE,
    action: AuditAction.UPDATE,
    fieldName: "description",
    oldValue: "Drive sales to achieve the Q1 revenue target of ₹45 Lakhs.",
    newValue:
      "Drive sales to achieve the Q1 revenue target of ₹50 Lakhs through new account acquisition and upselling to existing clients.",
    actorId: "u-vikram-nair",
    actorName: "Vikram Nair",
    actorRole: UserRole.MANAGER,
    changedAt: "2025-04-14T11:31:00.000Z",
  },

  // 5. Rahul submits goal sheet
  {
    id: "al-005",
    tableName: "goal_sheets",
    recordId: "gs-rahul-fy2025",
    action: AuditAction.UPDATE,
    fieldName: "status",
    oldValue: "draft",
    newValue: "submitted",
    actorId: "u-rahul-verma",
    actorName: "Rahul Verma",
    actorRole: UserRole.EMPLOYEE,
    changedAt: "2025-04-15T09:00:00.000Z",
  },

  // 6. Vikram approves Rahul's goal sheet
  {
    id: "al-006",
    tableName: "goal_sheets",
    recordId: "gs-rahul-fy2025",
    action: AuditAction.UPDATE,
    fieldName: "status",
    oldValue: "submitted",
    newValue: "approved",
    actorId: "u-vikram-nair",
    actorName: "Vikram Nair",
    actorRole: UserRole.MANAGER,
    changedAt: "2025-04-18T14:30:00.000Z",
  },

  // 7. Priya locks cycle (updates all approved goals to LOCKED)
  {
    id: "al-007",
    tableName: "cycle_configs",
    recordId: "cycle-fy2025",
    action: AuditAction.UPDATE,
    fieldName: "phase",
    oldValue: "GOAL_SETTING",
    newValue: "Q1",
    actorId: "u-priya-sharma",
    actorName: "Priya Sharma",
    actorRole: UserRole.ADMIN,
    changedAt: "2026-04-01T06:00:00.000Z",
  },

  // 8. Rahul creates Goal 5 in new FY2026 cycle
  {
    id: "al-008",
    tableName: "goals",
    recordId: GOAL_IDS.RAHUL_NEW_CLIENTS,
    action: AuditAction.INSERT,
    actorId: "u-rahul-verma",
    actorName: "Rahul Verma",
    actorRole: UserRole.EMPLOYEE,
    changedAt: "2026-05-05T10:00:00.000Z",
  },

  // 9. Sneha submits her FY2026 goal sheet
  {
    id: "al-009",
    tableName: "goal_sheets",
    recordId: "gs-sneha-fy2026",
    action: AuditAction.UPDATE,
    fieldName: "status",
    oldValue: "draft",
    newValue: "submitted",
    actorId: "u-sneha-patel",
    actorName: "Sneha Patel",
    actorRole: UserRole.EMPLOYEE,
    changedAt: "2026-05-10T12:00:00.000Z",
  },

  // 10. Priya creates FY2026 cycle config
  {
    id: "al-010",
    tableName: "cycle_configs",
    recordId: "cycle-fy2026",
    action: AuditAction.INSERT,
    actorId: "u-priya-sharma",
    actorName: "Priya Sharma",
    actorRole: UserRole.ADMIN,
    changedAt: "2026-04-28T09:00:00.000Z",
  },
];
