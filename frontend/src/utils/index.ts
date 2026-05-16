// New canonical util files
export * from "./permission.util";
export * from "./date.util";
export * from "./format.util";
export * from "./scoring.util";
export * from "./validation.util";

// Legacy stubs — re-export non-conflicting helpers
export { formatPercent, formatWithUnit, truncate } from "./format";
export { getScoreLevel, calcCompletionPercent } from "./scoring";
export type { ScoreLevel } from "./scoring";
export { isOverdue, isUpcoming } from "./date";
export { hasPermission } from "./permission";
