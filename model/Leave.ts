// models/Leave.ts
import mongoose from "mongoose";

export interface ILeave {
  userId: mongoose.Types.ObjectId;
  leaveType: string; // CL, SL, EL, LOP, etc.
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
  attachment?: string; // URL or file path
}

const LeaveSchema = new mongoose.Schema<ILeave>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  leaveType: { type: String, required: true },
  fromDate: { type: Date, required: true },
  toDate: { type: Date, required: true },
  isHalfDay: { type: Boolean, default: false },
  halfDayType: { type: String, enum: ["First Half", "Second Half"] },
  reason: { type: String, required: true },
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approverRemarks: String,
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  attachment: String,
}, { timestamps: true });

LeaveSchema.index({ userId: 1, fromDate: -1 });
LeaveSchema.index({ status: 1, approverId: 1 });

export default (mongoose.models.Leave as mongoose.Model<ILeave>) || mongoose.model<ILeave>("Leave", LeaveSchema);

