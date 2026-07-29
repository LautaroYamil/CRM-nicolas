import type { UserRole } from "@/types/database";

export const ROLES: readonly UserRole[] = ["admin", "seller"] as const;

export function isValidRole(value: string): value is UserRole {
  return ROLES.includes(value as UserRole);
}

export function canAccessAdmin(role: UserRole) {
  return role === "admin";
}
