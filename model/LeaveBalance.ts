// models/LeaveBalance.ts
//
// MIGRATION NOTE: legacy model — see Leave.ts. orgId is declared so new
// writes carry it; without the field Mongoose drops it silently on save.

import mongoose from "mongoose";

export interface ILeaveBalance {
  orgId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  leaveType: string;
  year: number;
  totalCredited: number;
  used: number;
  balance: number;
  lastUpdated: Date;
  lastUpdatedBy?: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
}

const LeaveBalanceSchema = new mongoose.Schema<ILeaveBalance>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    leaveType: { type: String, required: true },
    year: { type: Number, required: true },
    totalCredited: { type: Number, default: 0 },
    used: { type: Number, default: 0 },
    balance: { type: Number, default: 0 },
    lastUpdated: { type: Date, default: Date.now },
    lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

LeaveBalanceSchema.index({ userId: 1, year: 1, leaveType: 1 }, { unique: true });
LeaveBalanceSchema.index({ orgId: 1, userId: 1, year: 1 });

export default (mongoose.models.LeaveBalance as mongoose.Model<ILeaveBalance>) ||
  mongoose.model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);
