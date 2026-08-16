// lib/db/plugins/softDelete.ts
//
// Nothing in this application is ever hard-deleted through normal code paths.
// Deleted rows stay put with `deletedAt` set and are filtered out of every
// query by default.
//
// Opt back in explicitly:
//   Model.find().withDeleted()   — active + deleted (super admin views)
//   Model.find().onlyDeleted()   — recycle bin
//
// Permanent removal is Super Admin only and lives in lib/db/purge.ts, which
// snapshots the record into ActivityLog before destroying it.

import { Schema, Types } from "mongoose";
import { getContext } from "@/lib/context";

const QUERY_ONLY_HOOKS = [
  "find",
  "findOne",
  "findOneAndUpdate",
  "findOneAndDelete",
  "findOneAndReplace",
  "countDocuments",
  "distinct",
  "updateMany",
  "replaceOne",
  "deleteMany",
] as const;

const DUAL_HOOKS = ["updateOne", "deleteOne"] as const;

function filterDeleted(this: any) {
  const opts = typeof this.getOptions === "function" ? this.getOptions() : {};
  if (opts?.includeDeleted) return;
  if (opts?.onlyDeleted) {
    this.where({ deletedAt: { $ne: null } });
    return;
  }
  this.where({ deletedAt: null });
}

export function softDelete(schema: Schema) {
  schema.add({
    deletedAt: { type: Date, default: null, index: true },
    deletedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    deletedByRole: { type: String, default: null },
    deletionReason: { type: String, default: null },
  } as any);

  for (const hook of QUERY_ONLY_HOOKS) {
    schema.pre(hook, filterDeleted);
  }
  for (const hook of DUAL_HOOKS) {
    schema.pre(hook, { document: false, query: true }, filterDeleted);
  }

  schema.pre("aggregate", function (this: any) {
    const opts = this.options ?? {};
    if (opts.includeDeleted || opts.onlyDeleted) return;
    this.pipeline().unshift({ $match: { deletedAt: null } });
  });

  (schema.query as any).withDeleted = function (this: any) {
    return this.setOptions({ includeDeleted: true });
  };

  (schema.query as any).onlyDeleted = function (this: any) {
    return this.setOptions({ onlyDeleted: true });
  };

  /**
   * Soft-delete this document. Dependency guards (an employee with reportees,
   * a department with employees) belong in the service layer and must run
   * before this is called — this method does not cascade.
   */
  schema.methods.softDelete = async function (this: any, reason?: string) {
    if (this.deletedAt) return this;
    const ctx = getContext();

    this.deletedAt = new Date();
    this.deletedBy =
      ctx?.userId && ctx.userId !== "system"
        ? new Types.ObjectId(ctx.userId)
        : null;
    this.deletedByRole = ctx?.isSuperAdmin ? "SUPER_ADMIN" : ctx?.role ?? null;
    this.deletionReason = reason ?? null;

    this.$locals.__softDeleting = true;
    return this.save();
  };

  /** Restore a soft-deleted document. Super Admin only — enforced by RBAC. */
  schema.methods.restore = async function (this: any) {
    if (!this.deletedAt) return this;

    this.deletedAt = null;
    this.deletedBy = null;
    this.deletedByRole = null;
    this.deletionReason = null;

    this.$locals.__restoring = true;
    return this.save();
  };
}

// Generics must match mongoose's own `class Query<...>` declaration exactly,
// or TS rejects the merge with "All declarations of 'Query' must have
// identical type parameters". See node_modules/mongoose/types/query.d.ts.
declare module "mongoose" {
  interface Query<
    ResultType,
    DocType,
    THelpers = {},
    RawDocType = unknown,
    QueryOp = "find",
    TDocOverrides = Record<string, never>
  > {
    /** Include soft-deleted documents (super admin / recycle bin views). */
    withDeleted(): this;
    /** Return only soft-deleted documents. */
    onlyDeleted(): this;
  }
}
