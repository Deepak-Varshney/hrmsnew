// lib/activity.ts
//
// Single entry point for writing to the activity log.
//
// CRUD is captured automatically by the activityLog Mongoose plugin. Anything
// that isn't a document write — login, failed login, document download, PII
// reveal, export, impersonation, permission denied — calls logActivity()
// directly.
//
// The log is append-only. There is no update or delete path, for anyone,
// including Super Admin.

import { Types } from "mongoose";
import { getContext } from "@/lib/context";

export type Severity = "info" | "warning" | "critical";

/**
 * Never written into `changes`. We record that these fields changed, never
 * what they changed to.
 */
const REDACTED_PATHS = new Set([
  "passwordHash",
  "password",
  "twoFactorSecret",
  "aadhaar",
  "pan",
  "statutory.aadhaar",
  "statutory.pan",
  "statutory.uan",
  "bank.accountNumber",
  "accountNumber",
  "token",
  "refreshToken",
]);

export const REDACTED = "[REDACTED]";

/**
 * Actions that must stand out in the Super Admin console and are never
 * eligible for archival.
 */
const CRITICAL_ACTIONS = new Set([
  "auth.login.failed.repeated",
  "membership.role.changed",
  "membership.admin.created",
  "user.suspended",
  "employee.pii.revealed",
  "data.exported",
  "record.purged",
  "record.restored",
  "impersonation.started",
  "impersonation.ended",
  "org.created",
  "org.suspended",
  "org.deleted",
]);

const WARNING_ACTIONS = new Set([
  "auth.login.failed",
  "permission.denied",
  "record.deleted",
]);

export function severityFor(action: string): Severity {
  if (CRITICAL_ACTIONS.has(action)) return "critical";
  if (WARNING_ACTIONS.has(action)) return "warning";
  if (action.endsWith(".deleted")) return "warning";
  return "info";
}

/** Replace sensitive values in a diff payload, preserving the key. */
export function redact(
  obj?: Record<string, any> | null
): Record<string, any> | undefined {
  if (!obj) return undefined;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    const leaf = key.split(".").pop() ?? key;
    out[key] = REDACTED_PATHS.has(key) || REDACTED_PATHS.has(leaf) ? REDACTED : value;
  }
  return out;
}

export interface ActivityInput {
  action: string;
  entityType: string;
  entityId?: Types.ObjectId | string | null;
  /** Human-readable snapshot, e.g. "Rahul Sharma (EMP0142)". */
  entityLabel?: string | null;
  changes?: { before?: Record<string, any>; after?: Record<string, any> } | null;
  metadata?: Record<string, any> | null;
  severity?: Severity;
  /** Override the org from context (super admin acting on a specific org). */
  orgId?: string | Types.ObjectId | null;
}

export async function logActivity(input: ActivityInput): Promise<void> {
  const ctx = getContext();
  if (ctx?.suppressActivityLog) return;

  // Imported lazily: the model applies plugins that import this module.
  const { default: ActivityLog } = await import("@/model/ActivityLog");

  const orgId = input.orgId ?? ctx?.orgId ?? null;

  try {
    await ActivityLog.create({
      orgId: orgId ? new Types.ObjectId(orgId) : null,

      // Denormalized on purpose: if the actor is later removed, the log has
      // to stay readable.
      actorId:
        ctx?.userId && ctx.userId !== "system"
          ? new Types.ObjectId(ctx.userId)
          : null,
      actorName: ctx?.userName ?? "System",
      actorEmail: ctx?.userEmail ?? "system@internal",
      actorRole: ctx?.isSuperAdmin ? "SUPER_ADMIN" : ctx?.role ?? "SYSTEM",

      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ? new Types.ObjectId(input.entityId) : null,
      entityLabel: input.entityLabel ?? null,

      changes: input.changes
        ? {
            before: redact(input.changes.before),
            after: redact(input.changes.after),
          }
        : null,

      metadata: {
        ...(input.metadata ?? {}),
        ...(ctx?.impersonatedBy
          ? { impersonatedBy: ctx.impersonatedBy }
          : {}),
      },

      ip: ctx?.ip ?? null,
      userAgent: ctx?.userAgent ?? null,
      severity: input.severity ?? severityFor(input.action),
    });
  } catch (err) {
    // A logging failure must never take down the operation being logged, but
    // it must be loud — a silent gap in an audit trail is worse than noise.
    console.error("[activity] failed to write log entry", {
      action: input.action,
      entityType: input.entityType,
      error: err,
    });
  }
}
