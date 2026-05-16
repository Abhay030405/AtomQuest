import type { Permission } from "@/types/user.types";
import { can } from "@/constants/permissions";

export { can };

/** Convenience: returns true if the given permission array includes the action */
export function hasPermission(
  permissions: Permission[],
  action: Permission
): boolean {
  return can(permissions, action);
}
