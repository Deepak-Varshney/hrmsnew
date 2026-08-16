// lib/db/plugins/activityLog.ts
//
// Automatic activity capture for document writes. Non-CRUD events (login,
// download, PII reveal, export, impersonation) call logActivity() directly —
// see lib/activity.ts.
//
// Opt a model out with `new Schema({...}, { skipActivityLog: true })`.
// ActivityLog itself and Session are opted out.

import { Schema } from "mongoose";
import { getContext } from "@/lib/context";
import { logActivity } from "@/lib/activity";

/** Read a possibly-nested path off a plain object. */
function valueAt(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Paths that change on every write and carry no audit value. Excluding them
 * keeps the log readable.
 */
const NOISE_PATHS = new Set(["updatedAt", "createdAt", "__v"]);

function meaningfulPaths(paths: string[]) {
  return paths.filter((p) => !NOISE_PATHS.has(p) && !p.startsWith("$"));
}

function labelFor(schema: Schema, doc: any): string | null {
  const fn = (schema as any).options?.activityLabel;
  if (typeof fn === "function") {
    try {
      return fn(doc);
    } catch {
      /* fall through to defaults */
    }
  }
  return (
    doc?.displayName ??
    doc?.name ??
    doc?.title ??
    doc?.code ??
    doc?.email ??
    (doc?._id ? String(doc._id) : null)
  );
}

export function activityLog(schema: Schema) {
  if ((schema as any).options?.skipActivityLog) return;

  schema.pre("save", async function (this: any) {
    const ctx = getContext();
    if (ctx?.suppressActivityLog) return;

    this.$locals.__wasNew = this.isNew;

    if (this.isNew) return;

    const changed = meaningfulPaths(this.modifiedPaths());
    if (changed.length === 0) return;

    this.$locals.__changedPaths = changed;

    // One extra read per update, in exchange for a real before/after diff.
    // includeDeleted so soft-deletes and restores still capture prior state.
    try {
      this.$locals.__prev = await (this.constructor as any)
        .findOne({ _id: this._id })
        .setOptions({ includeDeleted: true })
        .lean();
    } catch {
      this.$locals.__prev = null;
    }
  });

  schema.post("save", async function (this: any, doc: any) {
    const ctx = getContext();
    if (ctx?.suppressActivityLog) return;

    const entityType = (doc.constructor as any)?.modelName ?? "Unknown";
    const base = entityType.toLowerCase();

    if (this.$locals.__wasNew) {
      await logActivity({
        action: `${base}.created`,
        entityType,
        entityId: doc._id,
        entityLabel: labelFor(schema, doc),
        orgId: doc.orgId ?? null,
      });
      return;
    }

    const changed: string[] = this.$locals.__changedPaths ?? [];
    if (changed.length === 0) return;

    const prev = this.$locals.__prev ?? {};
    const current = doc.toObject ? doc.toObject() : doc;

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    for (const path of changed) {
      before[path] = valueAt(prev, path);
      after[path] = valueAt(current, path);
    }

    let action = `${base}.updated`;
    if (this.$locals.__softDeleting) action = `${base}.deleted`;
    else if (this.$locals.__restoring) action = `${base}.restored`;

    await logActivity({
      action,
      entityType,
      entityId: doc._id,
      entityLabel: labelFor(schema, doc),
      changes: { before, after },
      orgId: doc.orgId ?? null,
    });
  });

  // findOneAndUpdate bypasses document middleware, so it needs its own pair.
  schema.pre("findOneAndUpdate", async function (this: any) {
    const ctx = getContext();
    if (ctx?.suppressActivityLog) return;
    try {
      this._activityPrev = await this.model
        .findOne(this.getFilter())
        .setOptions({ includeDeleted: true })
        .lean();
    } catch {
      this._activityPrev = null;
    }
  });

  schema.post("findOneAndUpdate", async function (this: any, doc: any) {
    const ctx = getContext();
    if (ctx?.suppressActivityLog || !doc) return;

    const entityType = this.model?.modelName ?? "Unknown";
    const prev = this._activityPrev ?? {};
    const current = doc.toObject ? doc.toObject() : doc;

    const update = this.getUpdate() ?? {};
    const touched = meaningfulPaths(
      Object.keys({ ...(update.$set ?? {}), ...(update.$unset ?? {}), ...update })
    );

    const before: Record<string, any> = {};
    const after: Record<string, any> = {};
    for (const path of touched) {
      before[path] = valueAt(prev, path);
      after[path] = valueAt(current, path);
    }

    await logActivity({
      action: `${entityType.toLowerCase()}.updated`,
      entityType,
      entityId: current._id,
      entityLabel: labelFor(schema, current),
      changes: { before, after },
      orgId: current.orgId ?? null,
    });
  });

  // Bulk writes: log the operation, not a per-document diff. Fetching every
  // affected row to diff it would be worse than the audit value it adds.
  for (const hook of ["updateMany", "deleteMany"] as const) {
    schema.post(hook, async function (this: any, res: any) {
      const ctx = getContext();
      if (ctx?.suppressActivityLog) return;

      const entityType = this.model?.modelName ?? "Unknown";
      await logActivity({
        action: `${entityType.toLowerCase()}.bulk.${
          hook === "updateMany" ? "updated" : "deleted"
        }`,
        entityType,
        entityLabel: null,
        metadata: {
          filter: this.getFilter?.() ?? null,
          update: hook === "updateMany" ? this.getUpdate?.() ?? null : null,
          matched: res?.matchedCount ?? null,
          modified: res?.modifiedCount ?? res?.deletedCount ?? null,
        },
        severity: "warning",
      });
    });
  }
}
