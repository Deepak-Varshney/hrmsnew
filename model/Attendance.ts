// models/Attendance.ts
import mongoose from "mongoose";

export interface IPunch { type: 'IN'|'OUT'; time: Date; device?: string; ip?: string; gps?: { lat:number; lon:number } | null; }
export interface IAttendance { userId: mongoose.Types.ObjectId; date: string; punches: IPunch[]; totalHours?: number; status?: 'Present'|'Absent'|'WFH'|'OnDuty' }

const PunchSchema = new mongoose.Schema({ type: String, time: Date, device: String, ip: String, gps: { lat:Number, lon:Number } }, { _id: false });

const AttendanceSchema = new mongoose.Schema<IAttendance>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date: { type: String, required: true },
  punches: { type: [PunchSchema], default: [] },
  totalHours: Number,
  status: { type: String, enum: ['Present','Absent','WFH','OnDuty'], default: 'Present' },
}, { timestamps: true });

AttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

export default (mongoose.models.Attendance as mongoose.Model<IAttendance>) || mongoose.model<IAttendance>('Attendance', AttendanceSchema);
