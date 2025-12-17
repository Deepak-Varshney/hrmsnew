// models/AuditLog.ts
import mongoose from "mongoose";

export interface IAuditLog {
  action: string; // e.g., "password_change", "attendance_edit", "leave_balance_adjust"
  userId: mongoose.Types.ObjectId; // User who performed the action
  targetUserId?: mongoose.Types.ObjectId; // User affected by the action
  entityType?: string; // "Attendance", "Leave", "User", etc.
  entityId?: mongoose.Types.ObjectId;
  oldValue?: any;
  newValue?: any;
  remarks?: string;
  ipAddress?: string;
  userAgent?: string;
}

const AuditLogSchema = new mongoose.Schema<IAuditLog>({
  action: { type: String, required: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  targetUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  entityType: String,
  entityId: mongoose.Schema.Types.Mixed,
  oldValue: mongoose.Schema.Types.Mixed,
  newValue: mongoose.Schema.Types.Mixed,
  remarks: String,
  ipAddress: String,
  userAgent: String,
}, { timestamps: true });

AuditLogSchema.index({ userId: 1, createdAt: -1 });
AuditLogSchema.index({ action: 1, createdAt: -1 });
AuditLogSchema.index({ targetUserId: 1, createdAt: -1 });

export default (mongoose.models.AuditLog as mongoose.Model<IAuditLog>) || mongoose.model<IAuditLog>("AuditLog", AuditLogSchema);

