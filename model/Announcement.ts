// models/Announcement.ts
import mongoose from "mongoose";

export interface IAnnouncement {
  title: string;
  content: string;
  isPinned: boolean;
  sendEmail: boolean;
  createdBy: mongoose.Types.ObjectId;
  targetRoles?: string[]; // If empty, visible to all
  expiresAt?: Date;
}

const AnnouncementSchema = new mongoose.Schema<IAnnouncement>({
  title: { type: String, required: true },
  content: { type: String, required: true },
  isPinned: { type: Boolean, default: false },
  sendEmail: { type: Boolean, default: false },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetRoles: [{ type: String }],
  expiresAt: Date,
}, { timestamps: true });

AnnouncementSchema.index({ isPinned: -1, createdAt: -1 });
AnnouncementSchema.index({ expiresAt: 1 });

export default (mongoose.models.Announcement as mongoose.Model<IAnnouncement>) || mongoose.model<IAnnouncement>("Announcement", AnnouncementSchema);

