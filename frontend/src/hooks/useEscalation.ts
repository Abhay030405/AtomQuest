import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { escalationService } from "@/services/escalation.service";
import type {
  EscalationRuleCreate,
  EscalationRuleUpdate,
} from "@/types/escalation.types";

// ── Rules ─────────────────────────────────────────────────────────────────────

export function useEscalationRules() {
  return useQuery({
    queryKey: ["escalation-rules"],
    queryFn: () => escalationService.getRules(),
  });
}

export function useCreateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: EscalationRuleCreate) =>
      escalationService.createRule(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalation-rules"] });
      toast.success("Escalation rule created.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useUpdateEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: EscalationRuleUpdate }) =>
      escalationService.updateRule(id, patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalation-rules"] });
      toast.success("Rule updated.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

export function useDeleteEscalationRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => escalationService.deleteRule(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["escalation-rules"] });
      toast.success("Rule deleted.");
    },
    onError: (err: Error) => toast.error(err.message),
  });
}

// ── Logs ──────────────────────────────────────────────────────────────────────

export function useEscalationLogs(params?: {
  rule_id?: string;
  status?: "open" | "resolved";
}) {
  return useQuery({
    queryKey: ["escalation-logs", params],
    queryFn: () => escalationService.getLogs({ ...params, limit: 200 }),
  });
}

// ── Run Now ───────────────────────────────────────────────────────────────────

export function useEscalationRunNow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => escalationService.runNow(),
    onSuccess: (result) => {
      qc.invalidateQueries({ queryKey: ["escalation-logs"] });
      const msg =
        result.rules_evaluated >= 0
          ? `Engine ran: ${result.rules_evaluated} rules evaluated, ${result.notifications_sent} notifications sent.`
          : "Engine triggered successfully.";
      toast.success(msg);
      if (result.errors?.length) {
        result.errors.forEach((e) => toast.error(`Engine error: ${e}`));
      }
    },
    onError: (err: Error) => toast.error(err.message),
  });
}
