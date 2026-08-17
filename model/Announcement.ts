// models/Announcement.ts
//
// MIGRATION NOTE: legacy model. orgId is declared so new writes are
// tenant-stamped — without the field, Mongoose's strict mode silently DROPS
// it on save and every tenant-scoped query then misses the row.

import mongoose from "mongoose";

export interface IAnnouncement {
  orgId?: mongoose.Types.ObjectId;
  title: string;
  content: string;
  isPinned: boolean;
  sendEmail: boolean;
  createdBy: mongoose.Types.ObjectId;
  /** Empty means everyone. */
  targetRoles?: string[];
  expiresAt?: Date;
  deletedAt?: Date | null;
}

const AnnouncementSchema = new mongoose.Schema<IAnnouncement>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    title: { type: String, required: true },
    content: { type: String, required: true },
    isPinned: { type: Boolean, default: false },
    sendEmail: { type: Boolean, default: false },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    targetRoles: [{ type: String }],
    expiresAt: Date,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AnnouncementSchema.index({ isPinned: -1, createdAt: -1 });
AnnouncementSchema.index({ expiresAt: 1 });
AnnouncementSchema.index({ orgId: 1, isPinned: -1, createdAt: -1 });

export default (mongoose.models.Announcement as mongoose.Model<IAnnouncement>) ||
  mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);
