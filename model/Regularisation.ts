// models/Regularisation.ts
import mongoose from "mongoose";

export interface IRegularisation {
  userId: mongoose.Types.ObjectId;
  date: string; // YYYY-MM-DD
  type: "Forgot Punch" | "Work From Home" | "On Duty" | "Other";
  reason: string;
  attachment?: string;
  status: "Pending" | "Approved" | "Rejected";
  approverId?: mongoose.Types.ObjectId;
  approverRemarks?: string;
  appliedAt: Date;
  reviewedAt?: Date;
  // Store original attendance data for audit
  originalAttendance?: {
    punches: any[];
    totalHours?: number;
    status?: string;
  };
  // Store new attendance data after approval
  newAttendance?: {
    punches: any[];
    totalHours?: number;
    status?: string;
  };
}

const RegularisationSchema = new mongoose.Schema<IRegularisation>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },
  type: { type: String, enum: ["Forgot Punch", "Work From Home", "On Duty", "Other"], required: true },
  reason: { type: String, required: true },
  attachment: String,
  status: { type: String, enum: ["Pending", "Approved", "Rejected"], default: "Pending" },
  approverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  approverRemarks: String,
  appliedAt: { type: Date, default: Date.now },
  reviewedAt: Date,
  originalAttendance: mongoose.Schema.Types.Mixed,
  newAttendance: mongoose.Schema.Types.Mixed,
}, { timestamps: true });

RegularisationSchema.index({ userId: 1, date: -1 });
RegularisationSchema.index({ status: 1, approverId: 1 });

export default (mongoose.models.Regularisation as mongoose.Model<IRegularisation>) || mongoose.model<IRegularisation>("Regularisation", RegularisationSchema);

