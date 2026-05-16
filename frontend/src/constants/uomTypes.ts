import { UoMType } from "@/types/goal.types";

export interface UoMTypeMeta {
  label: string;
  description: string;
  example: string;
  formulaDescription: string;
  inputPlaceholder: string;
  /** Lucide icon name */
  icon: string;
}

export const UOM_TYPE_META: Record<UoMType, UoMTypeMeta> = {
  [UoMType.MIN]: {
    label: "Higher is Better",
    description: "Higher is better (e.g. Sales Revenue, Units Produced)",
    example: "Sales Revenue: ₹50 Lakhs, Units Produced: 1000",
    formulaDescription: "Score = (Actual / Target) × 100. Capped at 100%.",
    inputPlaceholder: "Enter target value (e.g. 50 for 50 Lakhs)",
    icon: "TrendingUp",
  },
  [UoMType.MAX]: {
    label: "Lower is Better",
    description: "Lower is better (e.g. TAT, Cost, Error Rate)",
    example: "TAT: 2 days, Error Rate: 0.5%, Cost: ₹10 Lakhs",
    formulaDescription: "Score = (Target / Actual) × 100. Capped at 100%.",
    inputPlaceholder: "Enter target value (e.g. 2 for 2 days)",
    icon: "TrendingDown",
  },
  [UoMType.TIMELINE]: {
    label: "Date-Based Completion",
    description: "Date-based completion (Deadline driven)",
    example: "Certification by June 30, Product launch by Q2 end",
    formulaDescription: "Score = 100% if completed on/before target date, else 0%.",
    inputPlaceholder: "Select target completion date",
    icon: "Calendar",
  },
  [UoMType.ZERO]: {
    label: "Zero Equals Success",
    description: "Zero equals success (e.g. Safety Incidents, Complaints)",
    example: "Safety Incidents: 0, Customer Complaints: 0",
    formulaDescription: "Score = 100% if Actual = 0, else decreases proportionally.",
    inputPlaceholder: "Target is always 0",
    icon: "ShieldCheck",
  },
};
