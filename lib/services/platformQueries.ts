// lib/services/platformQueries.ts
//
// Super Admin reads. These deliberately span organisations.
//
// A super admin's context carries orgId: null, so the tenantScope plugin
// injects nothing and queries run platform-wide. That is the intended
// behaviour here and nowhere else.

import mongoose from "mongoose";
import Organization from "@/model/Organization";
import Membership from "@/model/Membership";
import User from "@/model/User";
import Employee from "@/model/Employee";
import ActivityLog from "@/model/ActivityLog";
import { assertSuperAdmin } from "@/lib/rbac";
import { runUnscoped } from "@/lib/context";
import { labelFor } from "@/lib/db/recordLabel";

/**
 * Every read in this file goes through here.
 *
 * Scoping is lifted explicitly rather than relying on orgId being null: in
 * admin mode (lib/actingOrg.ts) a super admin IS pinned to one org, and the
 * platform console must still report on all of them.
 */
async function platformRead<T>(
  reason: string,
  fn: () => Promise<T>,
): Promise<T> {
  await assertSuperAdmin(reason);
  return runUnscoped(fn) as Promise<T>;
}

export interface OrgRow {
  id: string;
  name: string;
  slug: string;
  status: string;
  createdAt: string;
  employees: number;
  admins: number;
}

export async function listOrganisations(): Promise<OrgRow[]> {
  return platformRead("list organisations", async () => {
    const orgs: any[] = await Organization.find()
      .sort({ createdAt: -1 })
      .lean();
    const orgIds = orgs.map((o) => o._id);

    const [employeeCounts, adminCounts] = await Promise.all([
      Employee.aggregate([
        {
          $match: {
            orgId: { $in: orgIds },
            "employment.status": { $ne: "exited" },
          },
        },
        { $group: { _id: "$orgId", count: { $sum: 1 } } },
      ]),
      Membership.aggregate([
        { $match: { orgId: { $in: orgIds }, role: "ADMIN", status: "active" } },
        { $group: { _id: "$orgId", count: { $sum: 1 } } },
      ]),
    ]);

    const employeesBy = new Map(
      employeeCounts.map((r: any) => [String(r._id), r.count]),
    );
    const adminsBy = new Map(
      adminCounts.map((r: any) => [String(r._id), r.count]),
    );

    return orgs.map((o) => ({
      id: String(o._id),
      name: o.name,
      slug: o.slug,
      status: o.status,
      createdAt: o.createdAt,
      employees: employeesBy.get(String(o._id)) ?? 0,
      admins: adminsBy.get(String(o._id)) ?? 0,
    }));
  });
}

export async function listPlatformUsers(search?: string) {
  return platformRead("list users", async () => {
    const filter: Record<string, any> = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    const users: any[] = await User.find(filter)
      .select("name email status isSuperAdmin lastLoginAt createdAt")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const memberships: any[] = await Membership.find({
      userId: { $in: users.map((u) => u._id) },
    })
      .populate("orgId", "name slug")
      .select("userId orgId role status")
      .lean();

    const byUser = new Map<string, any[]>();
    for (const m of memberships) {
      const key = String(m.userId);
      byUser.set(key, [...(byUser.get(key) ?? []), m]);
    }

    return users.map((u) => ({
      id: String(u._id),
      name: u.name,
      email: u.email,
      status: u.status,
      isSuperAdmin: Boolean(u.isSuperAdmin),
      lastLoginAt: u.lastLoginAt,
      memberships: (byUser.get(String(u._id)) ?? []).map((m) => ({
        org: m.orgId?.name ?? "—",
        slug: m.orgId?.slug ?? null,
        role: m.role,
        status: m.status,
      })),
    }));
  });
}

export interface ActivityFilters {
  orgId?: string;
  actorRole?: string;
  actorId?: string;
  severity?: string;
  action?: string;
  limit?: number;
}

/**
 * The platform activity feed.
 *
 * Filtering by actorRole=ADMIN answers the question this console exists for:
 * what has each org's admin been doing, in which org.
 */
export async function platformActivity(filters: ActivityFilters = {}) {
  return platformRead("read platform activity", async () => {
    const query: Record<string, any> = {};
    if (filters.orgId && mongoose.Types.ObjectId.isValid(filters.orgId)) {
      query.orgId = new mongoose.Types.ObjectId(filters.orgId);
    }
    if (filters.actorRole) query.actorRole = filters.actorRole;
    if (filters.actorId && mongoose.Types.ObjectId.isValid(filters.actorId)) {
      query.actorId = new mongoose.Types.ObjectId(filters.actorId);
    }
    if (filters.severity) query.severity = filters.severity;
    if (filters.action)
      query.action = { $regex: filters.action, $options: "i" };

    const rows: any[] = await ActivityLog.find(query)
      .populate("orgId", "name slug")
      .sort({ createdAt: -1 })
      .limit(filters.limit ?? 100)
      .lean();

    return rows.map((r) => ({
      id: String(r._id),
      org: r.orgId?.name ?? "Platform",
      actorName: r.actorName,
      actorEmail: r.actorEmail,
      actorRole: r.actorRole,
      action: r.action,
      entityType: r.entityType,
      entityLabel: r.entityLabel,
      severity: r.severity,
      createdAt: r.createdAt,
      changes: r.changes,
      ip: r.ip,
    }));
  });
}

/** Headline numbers for the platform overview. */
export async function platformOverview() {
  return platformRead("read platform overview", async () => {
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      orgs,
      activeOrgs,
      users,
      employees,
      criticalToday,
      deletionsThisWeek,
    ] = await Promise.all([
      Organization.countDocuments(),
      Organization.countDocuments({ status: "active" }),
      User.countDocuments({ isSuperAdmin: { $ne: true } }),
      Employee.countDocuments({ "employment.status": { $ne: "exited" } }),
      ActivityLog.countDocuments({
        severity: "critical",
        createdAt: { $gte: dayAgo },
      }),
      ActivityLog.countDocuments({
        action: { $regex: "\\.deleted$" },
        createdAt: { $gte: weekAgo },
      }),
    ]);

    return {
      orgs,
      activeOrgs,
      users,
      employees,
      criticalToday,
      deletionsThisWeek,
    };
  });
}

/**
 * Everything soft-deleted, across every organisation.
 *
 * Each model is queried separately rather than through a union, because the
 * collections have genuinely different shapes and a common projection would
 * lose the label that makes a row identifiable.
 */
export async function recycleBin() {
  return platformRead("read recycle bin", async () => {
    // Labels come from labelFor so they match the purge confirmation exactly.
    const models: Array<{ name: string; model: any }> = [
      { name: "Employee", model: Employee },
      { name: "Organization", model: Organization },
      { name: "User", model: User },
    ];

    const results = await Promise.all(
      models.map(async ({ name, model }) => {
        const rows: any[] = await model
          .find()
          .onlyDeleted()
          .sort({ deletedAt: -1 })
          .limit(100)
          .lean();

        return rows.map((r) => ({
          id: String(r._id),
          type: name,
          label: labelFor(name, r),
          deletedAt: r.deletedAt,
          deletedByRole: r.deletedByRole ?? null,
          reason: r.deletionReason ?? null,
          orgId: r.orgId ? String(r.orgId) : null,
        }));
      }),
    );

    return results
      .flat()
      .sort(
        (a, b) =>
          new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime(),
      );
  });
}
