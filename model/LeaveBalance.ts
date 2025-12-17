// models/LeaveBalance.ts
import mongoose from "mongoose";

export interface ILeaveBalance {
  userId: mongoose.Types.ObjectId;
  leaveType: string; // CL, SL, EL, etc.
  year: number; // e.g., 2024
  totalCredited: number;
  used: number;
  balance: number;
  lastUpdated: Date;
  lastUpdatedBy?: mongoose.Types.ObjectId; // HR/Manager who updated
}

const LeaveBalanceSchema = new mongoose.Schema<ILeaveBalance>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: String, required: true },
  year: { type: Number, required: true },
  totalCredited: { type: Number, default: 0 },
  used: { type: Number, default: 0 },
  balance: { type: Number, default: 0 },
  lastUpdated: { type: Date, default: Date.now },
  lastUpdatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
}, { timestamps: true });

LeaveBalanceSchema.index({ userId: 1, year: 1, leaveType: 1 }, { unique: true });

export default (mongoose.models.LeaveBalance as mongoose.Model<ILeaveBalance>) || mongoose.model<ILeaveBalance>("LeaveBalance", LeaveBalanceSchema);

