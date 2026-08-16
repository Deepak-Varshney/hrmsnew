// models/Attendance.ts
//
// MIGRATION NOTE: this is a legacy model. It keys on userId rather than
// employeeId, and it does not carry the tenantModel plugin yet — adding the
// plugin before every attendance route is wrapped in withContext would break
// them, because queries would filter on an orgId that is not in context.
//
// orgId and deletedAt are declared here so new writes carry them and the
// eventual switch to tenantModel is a one-line change rather than a
// backfill. Until then, new code filters on orgId explicitly.

import mongoose from "mongoose";

export interface IPunch {
  type: "IN" | "OUT";
  time: Date;
  device?: string;
  ip?: string;
  gps?: { lat: number; lon: number } | null;
}

export interface IAttendance {
  orgId?: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  /** "YYYY-MM-DD". */
  date: string;
  punches: IPunch[];
  totalHours?: number;
  status?: "Present" | "Absent" | "WFH" | "OnDuty";
  deletedAt?: Date | null;
}

const PunchSchema = new mongoose.Schema(
  {
    type: String,
    time: Date,
    device: String,
    ip: String,
    gps: { lat: Number, lon: Number },
  },
  { _id: false }
);

const AttendanceSchema = new mongoose.Schema<IAttendance>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    date: { type: String, required: true },
    punches: { type: [PunchSchema], default: [] },
    totalHours: Number,
    status: {
      type: String,
      enum: ["Present", "Absent", "WFH", "OnDuty"],
      default: "Present",
    },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });
// Team-by-date lookups on the dashboard and attendance page.
AttendanceSchema.index({ orgId: 1, date: 1 });
// A person's month.
AttendanceSchema.index({ orgId: 1, userId: 1, date: -1 });

export default (mongoose.models.Attendance as mongoose.Model<IAttendance>) ||
  mongoose.model<IAttendance>("Attendance", AttendanceSchema);
