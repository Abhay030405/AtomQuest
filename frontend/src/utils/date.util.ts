import {
  format,
  parseISO,
  formatDistanceToNow,
  differenceInDays,
  isWithinInterval,
} from "date-fns";
import { CyclePhase } from "@/types/cycle.types";

export function formatDate(iso: string, fmt = "dd MMM yyyy"): string {
  return format(parseISO(iso), fmt);
}

export function formatDateTime(iso: string): string {
  return format(parseISO(iso), "dd MMM yyyy, hh:mm a");
}

export function timeAgo(iso: string): string {
  return formatDistanceToNow(parseISO(iso), { addSuffix: true });
}

export function daysUntil(iso: string): number {
  return Math.max(0, differenceInDays(parseISO(iso), new Date()));
}

export function isInWindow(windowOpen: string, windowClose: string): boolean {
  const now = new Date();
  return isWithinInterval(now, {
    start: parseISO(windowOpen),
    end: parseISO(windowClose),
  });
}

export function quarterLabel(phase: CyclePhase): string {
  switch (phase) {
    case CyclePhase.GOAL_SETTING:
      return "Goal Setting";
    case CyclePhase.Q1:
      return "Q1 (Apr–Jun)";
    case CyclePhase.Q2:
      return "Q2 (Jul–Sep)";
    case CyclePhase.Q3:
      return "Q3 (Oct–Dec)";
    case CyclePhase.Q4:
      return "Q4 (Jan–Mar)";
    default:
      return phase;
  }
}
