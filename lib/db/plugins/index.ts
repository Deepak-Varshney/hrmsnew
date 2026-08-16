// lib/db/plugins/index.ts
import type { Schema } from "mongoose";
import { tenantScope } from "./tenantScope";
import { softDelete } from "./softDelete";
import { activityLog } from "./activityLog";

export { tenantScope, softDelete, activityLog };

/**
 * Standard plugin set for a tenant-owned model: org scoping, soft delete,
 * and automatic activity capture.
 *
 *   const Schema = new mongoose.Schema({ ... }, { timestamps: true });
 *   Schema.plugin(tenantModel);
 *
 * Order matters: tenantScope adds orgId before activityLog reads it.
 */
export function tenantModel(schema: Schema) {
  schema.plugin(tenantScope);
  schema.plugin(softDelete);
  schema.plugin(activityLog);
}

/**
 * For platform-level models that are not owned by a tenant (Organization,
 * User): soft delete and activity capture, but no org scoping.
 */
export function platformModel(schema: Schema) {
  schema.plugin(softDelete);
  schema.plugin(activityLog);
}
