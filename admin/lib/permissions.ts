export const permissions = ["users.read", "users.update", "users.suspend", "jobs.read", "jobs.retry", "billing.read", "billing.manage", "analytics.read", "system.read", "settings.read"] as const;
export type Permission = typeof permissions[number];

// Only the backend's current admin role grants access. Future roles must first be enforced there.
export function can(role: string | undefined, permission: Permission): boolean {
  return role === "admin" && permissions.includes(permission);
}
