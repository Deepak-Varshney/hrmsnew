// lib/db/plugins/tenantScope.ts
//
// Forces every query and write on a tenant-owned model to be scoped to the
// organization in request context.
//
// The point of doing this here rather than in each route is that a forgotten
// filter becomes impossible. A normal user cannot read another tenant's data
// even if they hand-craft the filter object, because the scope is applied
// last and overwrites whatever orgId the caller supplied.

import { Schema, Types } from "mongoose";
import { getContext } from "@/lib/context";

/** Query middleware where `this` is always a Query. */
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

/**
 * In Mongoose 9 these are BOTH query and document middleware. Registering
 * them without options would also fire on documents, where `this.where` does
 * not exist. Scope them to queries explicitly.
 */
const DUAL_HOOKS = ["updateOne", "deleteOne"] as const;

function scopeQuery(this: any) {
  const ctx = getContext();
  if (!ctx || ctx.bypassTenantScope) return;
  if (!ctx.orgId) return; // platform-level work is not org-scoped

  // .where() merges into the filter, overwriting any caller-supplied orgId.
  this.where({ orgId: new Types.ObjectId(ctx.orgId) });
}

export function tenantScope(schema: Schema) {
  schema.add({
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
  } as any);

  for (const hook of QUERY_ONLY_HOOKS) {
    schema.pre(hook, scopeQuery);
  }
  for (const hook of DUAL_HOOKS) {
    schema.pre(hook, { document: false, query: true }, scopeQuery);
  }

  schema.pre("aggregate", function (this: any) {
    const ctx = getContext();
    if (!ctx || ctx.bypassTenantScope || !ctx.orgId) return;
    this.pipeline().unshift({
      $match: { orgId: new Types.ObjectId(ctx.orgId) },
    });
  });

  schema.pre("save", function (this: any) {
    const ctx = getContext();

    if (this.isNew) {
      if (!this.orgId && ctx?.orgId) {
        this.orgId = new Types.ObjectId(ctx.orgId);
      }
      return;
    }

    // orgId is immutable. A document never moves between tenants.
    if (this.isModified("orgId")) {
      throw new Error(
        "orgId is immutable — a document cannot be moved between organizations."
      );
    }
  });
}
