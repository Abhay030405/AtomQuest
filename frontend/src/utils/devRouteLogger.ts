import { matchPath } from "react-router-dom";
import { ROUTES, ROUTE_PATTERNS } from "@/constants/routes";

const ROUTE_MATCHES = [
  ROUTES.LOGIN,
  "/",
  ROUTE_PATTERNS.EMPLOYEE.ROOT,
  ROUTE_PATTERNS.EMPLOYEE.GOALS,
  ROUTE_PATTERNS.EMPLOYEE.QUARTERLY_UPDATE,
  ROUTE_PATTERNS.MANAGER.ROOT,
  ROUTE_PATTERNS.MANAGER.REVIEW,
  ROUTE_PATTERNS.MANAGER.REVIEW_SHEET,
  ROUTE_PATTERNS.MANAGER.TEAM_GOALS,
  ROUTE_PATTERNS.MANAGER.CHECKIN,
  ROUTE_PATTERNS.ADMIN.ROOT,
  ROUTE_PATTERNS.ADMIN.CYCLES,
  ROUTE_PATTERNS.ADMIN.SHARED_GOALS,
  ROUTE_PATTERNS.ADMIN.AUDIT,
  ROUTE_PATTERNS.ADMIN.REPORTS,
  ROUTE_PATTERNS.ADMIN.GOAL_UNLOCK,
  "/employee/*",
  "/manager/*",
  "/admin/*",
];

function resolveStatus(pathname: string): number {
  const matched = ROUTE_MATCHES.some((pattern) => matchPath(pattern, pathname));
  return matched ? 200 : 404;
}

export function logRouteChange(pathname: string): void {
  if (!import.meta.env.DEV) return;

  const status = resolveStatus(pathname);

  fetch("/__dev/route-log", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ path: pathname, status }),
  }).catch(() => {
    // Swallow network errors during dev logging.
  });
}
