// models/Leave.ts
//
// MIGRATION NOTE: legacy model — keys on userId, not employeeId, and does not
// carry tenantModel yet (adding it before every leave route is wrapped would
// break them). orgId is declared here so new writes are tenant-stamped;
// without the field, Mongoose's strict mode silently DROPS orgId on save and
// every tenant-scoped query then misses the row.

import mongoose from "mongoose";

export interface ILeave {
  orgId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  leaveType: string; // CL, SL, EL, LOP
  fromDate: Date;
  toDate: Date;
  isHalfDay: boolean;
  halfDayType?: "First Half" | "Second Half";
  reason: string;
  status: "Pending" | "Approved" | "Rejected";
  approverId?: mongoose.Types.ObjectId;
  approverRemarks?: string;
  appliedAt: Date;
  reviewedAt?: Date;
  attachment?: string;
  deletedAt?: Date | null;
}

const LeaveSchema = new mongoose.Schema<ILeave>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leaveType: { type: String, required: true },
    fromDate: { type: Date, required: true },
    toDate: { type: Date, required: true },
    isHalfDay: { type: Boolean, default: false },
    halfDayType: { type: String, enum: ["First Half", "Second Half"] },
    reason: { type: String, required: true },
    status: {
      type: String,
      enum: ["Pending", "Approved", "Rejected"],
      default: "Pending",
    },
    approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approverRemarks: String,
    appliedAt: { type: Date, default: Date.now },
    reviewedAt: Date,
    attachment: String,
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LeaveSchema.index({ userId: 1, fromDate: -1 });
LeaveSchema.index({ status: 1, approverId: 1 });
// Overlap checks and the team approval queue.
LeaveSchema.index({ orgId: 1, userId: 1, fromDate: 1, toDate: 1 });
LeaveSchema.index({ orgId: 1, status: 1, appliedAt: -1 });

export default (mongoose.models.Leave as mongoose.Model<ILeave>) ||
  mongoose.model<ILeave>("Leave", LeaveSchema);
