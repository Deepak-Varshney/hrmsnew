// lib/rbac/guard.ts
//
// Permission checks. Every route handler and server component that touches
// tenant data goes through can() / assertCan().

import { getContext } from "@/lib/context";
import { logActivity } from "@/lib/activity";
import { permissionsFor, type Permission, type Scope } from "./permissions";

export class ForbiddenError extends Error {
  readonly status = 403;
  readonly permission: Permission | string;

  constructor(permission: Permission | string, message?: string) {
    super(message ?? `Forbidden: missing permission "${permission}"`);
    this.name = "ForbiddenError";
    this.permission = permission;
  }
}

export class UnauthenticatedError extends Error {
  readonly status = 401;
  constructor(message = "Authentication required") {
    super(message);
    this.name = "UnauthenticatedError";
  }
}

/**
 * The scope at which `permission` is granted to the current caller, or "none".
 *
 * Super Admin short-circuits to "platform" for everything — deliberately, so
 * that adding a new permission never silently locks out the one role that is
 * meant to be able to do anything.
 */
export function can(permission: Permission): Scope {
  const ctx = getContext();
  if (!ctx) return "none";
  if (ctx.isSuperAdmin) return "platform";
  if (!ctx.role) return "none";
  return permissionsFor(ctx.role)[permission] ?? "none";
}

export function has(permission: Permission): boolean {
  return can(permission) !== "none";
}

/**
 * Throw unless the caller holds `permission`. Denials are recorded — a burst
 * of them is a useful signal in the Super Admin console.
 */
export async function assertCan(permission: Permission): Promise<Scope> {
  const ctx = getContext();
  if (!ctx) throw new UnauthenticatedError();

  const scope = can(permission);
  if (scope !== "none") return scope;

  await logActivity({
    action: "permission.denied",
    entityType: "Permission",
    entityLabel: permission,
    metadata: { permission, role: ctx.role, isSuperAdmin: ctx.isSuperAdmin },
    severity: "warning",
  });

  throw new ForbiddenError(permission);
}

/** Throw unless the caller is the platform Super Admin. */
export async function assertSuperAdmin(action = "platform operation"): Promise<void> {
  const ctx = getContext();
  if (!ctx) throw new UnauthenticatedError();
  if (ctx.isSuperAdmin) return;

  await logActivity({
    action: "permission.denied",
    entityType: "Platform",
    entityLabel: action,
    metadata: { action, role: ctx.role },
    severity: "warning",
  });

  throw new ForbiddenError("platform", `Forbidden: ${action} is Super Admin only`);
}

/**
 * Restore is Super Admin only by default. An org may opt in to letting its
 * admins restore recently-deleted records — see Organization.settings.
 * Permanent delete is never delegated.
 */
export async function canRestore(orgId?: string | null): Promise<boolean> {
  const ctx = getContext();
  if (!ctx) return false;
  if (ctx.isSuperAdmin) return true;
  if (ctx.role !== "ADMIN") return false;

  const targetOrg = orgId ?? ctx.orgId;
  if (!targetOrg) return false;

  const { default: Organization } = await import("@/model/Organization");
  const org = await Organization.findById(targetOrg).lean();
  return Boolean((org as any)?.settings?.allowAdminRestore);
}

/**
 * Whether a restore is still inside the org's admin restore window.
 * Super Admin is never time-limited.
 */
export async function isWithinRestoreWindow(
  deletedAt: Date | null | undefined,
  orgId?: string | null
): Promise<boolean> {
  const ctx = getContext();
  if (ctx?.isSuperAdmin) return true;
  if (!deletedAt) return false;

  const targetOrg = orgId ?? ctx?.orgId;
  if (!targetOrg) return false;

  const { default: Organization } = await import("@/model/Organization");
  const org: any = await Organization.findById(targetOrg).lean();
  const days = org?.settings?.adminRestoreWindowDays ?? 30;

  const cutoff = Date.now() - days * 24 * 60 * 60 * 1000;
  return deletedAt.getTime() >= cutoff;
}
