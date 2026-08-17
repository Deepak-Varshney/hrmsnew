// lib/services/activityQueries.ts
//
// The org-scoped activity log — what an admin sees for their own tenant.
//
// The platform-wide equivalent lives in platformQueries.ts and deliberately
// lifts scoping. This one does not: orgId comes from the request context, so
// an admin cannot read another tenant's trail by editing the URL.

import mongoose from "mongoose";
import ActivityLog from "@/model/ActivityLog";
import { getContext, requireOrgId } from "@/lib/context";
import { assertCan } from "@/lib/rbac";

export interface OrgActivityFilters {
  actorRole?: string;
  severity?: string;
  limit?: number;
}

export async function orgActivity(filters: OrgActivityFilters = {}) {
  const scope = await assertCan("activity.read");

  const orgId = requireOrgId();
  const query: Record<string, any> = {
    orgId: new mongoose.Types.ObjectId(orgId),
  };

  // Anything narrower than org scope sees only its own actions. Widening a
  // manager to their whole team here would mean reconstructing the subtree as
  // actor ids, and an audit trail is the wrong place to be approximate.
  if (scope !== "org" && scope !== "platform") {
    const ctx = getContext();
    if (ctx?.userId) query.actorId = new mongoose.Types.ObjectId(ctx.userId);
  }

  if (filters.actorRole) query.actorRole = filters.actorRole;
  if (filters.severity) query.severity = filters.severity;

  const rows: any[] = await ActivityLog.find(query)
    .sort({ createdAt: -1 })
    .limit(filters.limit ?? 150)
    .lean();

  return rows.map((r) => ({
    id: String(r._id),
    actorName: r.actorName,
    actorRole: r.actorRole,
    action: r.action,
    entityType: r.entityType,
    entityLabel: r.entityLabel,
    severity: r.severity,
    createdAt: r.createdAt,
  }));
}
