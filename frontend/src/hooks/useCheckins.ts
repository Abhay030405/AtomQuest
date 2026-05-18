import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  checkinService,
  type CreateCheckinInput,
  type UpdateCheckinInput,
} from "@/services/checkin.service";

const QK = {
  teamStatus: (quarter: string, cycleId: string) =>
    ["checkins", "team-status", quarter, cycleId] as const,
  employeeDetail: (employeeId: string, quarter: string, cycleId: string) =>
    ["checkins", "employee", employeeId, quarter, cycleId] as const,
  myCheckins: (quarter: string, cycleId: string) =>
    ["checkins", "my", quarter, cycleId] as const,
};

export function useTeamCheckinStatus(quarter: string, cycleId: string) {
  return useQuery({
    queryKey: QK.teamStatus(quarter, cycleId),
    queryFn: () => checkinService.getTeamStatus(quarter, cycleId),
    enabled: Boolean(quarter && cycleId),
  });
}

export function useEmployeeCheckinDetail(
  employeeId: string | null,
  quarter: string,
  cycleId: string
) {
  return useQuery({
    queryKey: QK.employeeDetail(employeeId ?? "", quarter, cycleId),
    queryFn: () =>
      checkinService.getEmployeeDetail(employeeId!, quarter, cycleId),
    enabled: Boolean(employeeId && quarter && cycleId),
  });
}

export function useCreateCheckin(quarter: string, cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CreateCheckinInput) => checkinService.createCheckin(input),
    onSuccess: (_data, variables) => {
      toast.success("Check-in submitted");
      qc.invalidateQueries({ queryKey: QK.teamStatus(quarter, cycleId) });
      qc.invalidateQueries({
        queryKey: QK.employeeDetail(variables.employeeId, quarter, cycleId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to submit check-in");
    },
  });
}

export function useUpdateCheckin(
  employeeId: string,
  quarter: string,
  cycleId: string
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateCheckinInput) => checkinService.updateCheckin(input),
    onSuccess: () => {
      toast.success("Check-in updated");
      qc.invalidateQueries({ queryKey: QK.teamStatus(quarter, cycleId) });
      qc.invalidateQueries({
        queryKey: QK.employeeDetail(employeeId, quarter, cycleId),
      });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to update check-in");
    },
  });
}

export function useMyCheckins(quarter: string, cycleId: string) {
  return useQuery({
    queryKey: QK.myCheckins(quarter, cycleId),
    queryFn: () => checkinService.getMyCheckins(quarter, cycleId),
    enabled: Boolean(quarter && cycleId),
  });
}

export function useAcknowledgeCheckin(quarter: string, cycleId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (checkinId: string) => checkinService.acknowledgeCheckin(checkinId),
    onSuccess: () => {
      toast.success("Check-in acknowledged");
      qc.invalidateQueries({ queryKey: QK.myCheckins(quarter, cycleId) });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Failed to acknowledge check-in");
    },
  });
}
