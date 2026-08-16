// model/Membership.ts
//
// Links a global User to an Organization with a role. This is where `role`
// lives — not on User — so the same person can hold different roles in
// different orgs without any schema change.
//
// Super Admin has NO membership. That role is the `isSuperAdmin` flag on User
// and is checked before any org is resolved.
//
// Deliberately NOT tenant-scoped: login has to look up a user's memberships
// across all orgs before an org is chosen, which the tenantScope plugin would
// block.

import mongoose, { Schema } from "mongoose";
import { softDelete, activityLog } from "@/lib/db/plugins";

export type MembershipRole = "ADMIN" | "MANAGER" | "LEAD" | "EMPLOYEE";
export type MembershipStatus = "invited" | "active" | "suspended";

export interface IMembership {
  userId: mongoose.Types.ObjectId;
  orgId: mongoose.Types.ObjectId;
  role: MembershipRole;
  /** The Employee record for this user in this org, once created. */
  employeeId?: mongoose.Types.ObjectId | null;
  status: MembershipStatus;
  invitedBy?: mongoose.Types.ObjectId | null;
  joinedAt?: Date | null;
  deletedAt?: Date | null;
}

const MembershipSchema = new Schema<IMembership>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    role: {
      type: String,
      enum: ["ADMIN", "MANAGER", "LEAD", "EMPLOYEE"],
      required: true,
      default: "EMPLOYEE",
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },
    status: {
      type: String,
      enum: ["invited", "active", "suspended"],
      default: "invited",
      index: true,
    },
    invitedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    joinedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    activityLabel: (doc: any) => `${doc.role} membership`,
  } as any
);

// One membership per user per org (among live records).
MembershipSchema.index(
  { userId: 1, orgId: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
// Org member list, filtered by role
MembershipSchema.index({ orgId: 1, role: 1, status: 1 });

MembershipSchema.plugin(softDelete);
MembershipSchema.plugin(activityLog);

export default (mongoose.models.Membership as mongoose.Model<IMembership>) ||
  mongoose.model<IMembership>("Membership", MembershipSchema);
