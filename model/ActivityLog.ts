// model/ActivityLog.ts
//
// Append-only audit trail. Every action by every actor lands here.
//
// There is deliberately no update or delete path for this collection — not in
// the API, not for Super Admin. When a record is permanently purged, its final
// snapshot is written here first, and this entry becomes the only surviving
// trace of it.
//
// Supersedes model/AuditLog.ts (legacy, single-tenant, manual-call-only).

import mongoose, { Schema } from "mongoose";

export type Severity = "info" | "warning" | "critical";
export type ActorRole = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE" | "SYSTEM";

export interface IActivityLog {
  /** null for platform-level actions (org creation, cross-org super admin work). */
  orgId: mongoose.Types.ObjectId | null;

  // Actor fields are denormalized snapshots. If the user is later removed,
  // the log must still be readable — IDs alone would leave orphaned rows.
  actorId: mongoose.Types.ObjectId | null;
  actorName: string;
  actorEmail: string;
  actorRole: ActorRole;

  action: string;
  entityType: string;
  entityId: mongoose.Types.ObjectId | null;
  entityLabel: string | null;

  changes: { before?: Record<string, any>; after?: Record<string, any> } | null;
  metadata: Record<string, any> | null;

  ip: string | null;
  userAgent: string | null;
  severity: Severity;

  createdAt: Date;
}

const ActivityLogSchema = new Schema<IActivityLog>(
  {
    orgId: {
      type: Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
      index: true,
    },

    actorId: { type: Schema.Types.ObjectId, ref: "User", default: null },
    actorName: { type: String, required: true },
    actorEmail: { type: String, required: true },
    actorRole: {
      type: String,
      enum: ["SUPER_ADMIN", "ADMIN", "MANAGER", "EMPLOYEE", "SYSTEM"],
      required: true,
    },

    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: Schema.Types.ObjectId, default: null },
    entityLabel: { type: String, default: null },

    changes: { type: Schema.Types.Mixed, default: null },
    metadata: { type: Schema.Types.Mixed, default: null },

    ip: { type: String, default: null },
    userAgent: { type: String, default: null },
    severity: {
      type: String,
      enum: ["info", "warning", "critical"],
      default: "info",
      index: true,
    },
  },
  {
    // Only createdAt — an audit entry is never modified.
    timestamps: { createdAt: true, updatedAt: false },

    // This model must not log its own writes, and is never soft-deleted.
    skipActivityLog: true,
  } as any
);

// Org activity feed
ActivityLogSchema.index({ orgId: 1, createdAt: -1 });
// "What happened to this record?" — the entity timeline on a profile page
ActivityLogSchema.index({ orgId: 1, entityType: 1, entityId: 1, createdAt: -1 });
// "What has this person done?" — per-admin trail in the Super Admin console
ActivityLogSchema.index({ actorId: 1, createdAt: -1 });
// Critical-action dashboards
ActivityLogSchema.index({ orgId: 1, severity: 1, createdAt: -1 });
// Global feed filtered by action type
ActivityLogSchema.index({ action: 1, createdAt: -1 });
// Super Admin: admin actions grouped by org
ActivityLogSchema.index({ actorRole: 1, orgId: 1, createdAt: -1 });

export default (mongoose.models.ActivityLog as mongoose.Model<IActivityLog>) ||
  mongoose.model<IActivityLog>("ActivityLog", ActivityLogSchema);
