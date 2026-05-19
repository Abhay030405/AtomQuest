// ─── Escalation types ────────────────────────────────────────────────────────

export type EscalationTrigger =
  | "goals_not_submitted"
  | "manager_approval_overdue"
  | "checkin_not_completed";

export const TRIGGER_LABELS: Record<EscalationTrigger, string> = {
  goals_not_submitted: "Goals Not Submitted",
  manager_approval_overdue: "Manager Approval Overdue",
  checkin_not_completed: "Check-in Not Completed",
};

export const TRIGGER_DESCRIPTIONS: Record<EscalationTrigger, string> = {
  goals_not_submitted:
    "Employee has not submitted their goal sheet within N days of cycle open.",
  manager_approval_overdue:
    "Manager has not approved a submitted goal sheet within N days.",
  checkin_not_completed:
    "Manager has not completed a quarterly check-in within the active window.",
};

export type ChainTarget = "self" | "manager" | "hr";

export const TARGET_LABELS: Record<ChainTarget, string> = {
  self: "Notify Person",
  manager: "Notify Manager",
  hr: "Notify HR / Admin",
};

export interface ChainStep {
  target: ChainTarget;
  delay_days: number;
}

export interface EscalationRule {
  id: string;
  name: string;
  trigger_condition: EscalationTrigger;
  threshold_days: number;
  escalation_chain: ChainStep[];
  notification_title_template: string;
  notification_body_template: string;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface EscalationRuleCreate {
  name: string;
  trigger_condition: EscalationTrigger;
  threshold_days: number;
  escalation_chain: ChainStep[];
  notification_title_template: string;
  notification_body_template: string;
  is_active: boolean;
}

export interface EscalationRuleUpdate {
  name?: string;
  threshold_days?: number;
  escalation_chain?: ChainStep[];
  notification_title_template?: string;
  notification_body_template?: string;
  is_active?: boolean;
}

export type EscalationLogStatus = "open" | "resolved";

export interface EscalationLog {
  id: string;
  rule_id: string;
  subject_user_id: string;
  notified_user_id: string;
  chain_level: number;
  trigger_fired_at: string;
  notified_at: string;
  status: EscalationLogStatus;
  resolved_at: string | null;
  cycle_id: string | null;
  context_data: {
    subject_user_name?: string;
    subject_user_email?: string;
    manager_name?: string;
    employee_name?: string;
    cycle_id?: string;
    days_elapsed?: number | string;
    [key: string]: string | number | undefined;
  } | null;
  created_at: string;
}

export interface EscalationRunResult {
  rules_evaluated: number;
  notifications_sent: number;
  errors: string[];
}
