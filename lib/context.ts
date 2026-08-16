// lib/context.ts
//
// Per-request context, carried via AsyncLocalStorage.
//
// Everything tenant-aware reads from here: the Mongoose plugins (tenant
// scoping, soft delete, activity logging) and the RBAC engine. Nothing should
// thread orgId or the actor through function arguments by hand.
//
// IMPORTANT: AsyncLocalStorage requires the Node.js runtime. Next.js
// middleware runs on the Edge runtime by default, so context is established
// inside route handlers and server components — not in middleware.

import { AsyncLocalStorage } from "node:async_hooks";

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface RequestContext {
  /** Authenticated User._id, as a string. */
  userId: string;
  userName: string;
  userEmail: string;

  /** Platform super admin. Has no Membership and is never org-scoped. */
  isSuperAdmin: boolean;

  /** Active organization. null for platform-level (super admin) work. */
  orgId: string | null;

  /** Role within `orgId`. null for super admin and unauthenticated system work. */
  role: Role | null;

  /** Employee._id for this user within `orgId`, if they have one. */
  employeeId: string | null;

  /**
   * Employee._ids in this user's reporting subtree (self + all descendants).
   * Populated lazily by the RBAC engine — see lib/rbac/scope.ts. Empty until
   * something actually needs a team-scoped query.
   */
  teamIds: string[] | null;

  ip?: string;
  userAgent?: string;

  /**
   * Skip tenant scoping. Only for seeds, migrations, cron, and super admin
   * cross-org reads. Never set this from a user-facing request path.
   */
  bypassTenantScope: boolean;

  /** Skip activity logging. Only for seeds, migrations, and backfills. */
  suppressActivityLog: boolean;

  /** Set during super admin impersonation; stamped onto every log entry. */
  impersonatedBy?: { userId: string; userEmail: string };
}

const storage = new AsyncLocalStorage<RequestContext>();

/** Current context, or undefined outside a context scope. */
export function getContext(): RequestContext | undefined {
  return storage.getStore();
}

/** Current context, throwing if absent. Use where a caller is mandatory. */
export function requireContext(): RequestContext {
  const ctx = storage.getStore();
  if (!ctx) {
    throw new Error(
      "No request context. Wrap the call in runWithContext() or runAsSystem()."
    );
  }
  return ctx;
}

/** Current org id, throwing if not org-scoped. */
export function requireOrgId(): string {
  const ctx = requireContext();
  if (!ctx.orgId) {
    throw new Error("No organization in context for an org-scoped operation.");
  }
  return ctx.orgId;
}

export function runWithContext<T>(
  ctx: Omit<RequestContext, "bypassTenantScope" | "suppressActivityLog" | "teamIds"> &
    Partial<Pick<RequestContext, "bypassTenantScope" | "suppressActivityLog" | "teamIds">>,
  fn: () => Promise<T> | T
): Promise<T> | T {
  return storage.run(
    {
      teamIds: null,
      bypassTenantScope: false,
      suppressActivityLog: false,
      ...ctx,
    },
    fn
  );
}

/**
 * Run without tenant scoping or activity logging: seeds, migrations, cron.
 * Do not use to serve a user request.
 */
export function runAsSystem<T>(fn: () => Promise<T> | T): Promise<T> | T {
  return storage.run(
    {
      userId: "system",
      userName: "System",
      userEmail: "system@internal",
      isSuperAdmin: true,
      orgId: null,
      role: null,
      employeeId: null,
      teamIds: null,
      bypassTenantScope: true,
      suppressActivityLog: true,
    },
    fn
  );
}

/**
 * Run a block with tenant scoping lifted but activity logging intact.
 * For super admin cross-org reads, where actions must still be recorded.
 */
export function runUnscoped<T>(fn: () => Promise<T> | T): Promise<T> | T {
  const current = requireContext();
  return storage.run({ ...current, bypassTenantScope: true }, fn);
}

/** Narrow the current context to a specific org (super admin drill-down). */
export function runInOrg<T>(orgId: string, fn: () => Promise<T> | T): Promise<T> | T {
  const current = requireContext();
  return storage.run({ ...current, orgId, teamIds: null }, fn);
}

/** Cache the resolved team subtree on the current context. */
export function setTeamIds(ids: string[]): void {
  const ctx = getContext();
  if (ctx) ctx.teamIds = ids;
}
