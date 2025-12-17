// model/Settings.ts
import mongoose from "mongoose";

export interface ISettings {
  officeStartTime: string;
  officeEndTime: string;
  weeklyOffs: string[];
  geoFenceEnabled: boolean;
  geoFenceRadius: number;
  ipRestrictionEnabled: boolean;
  allowedIPs: string;
}

const SettingsSchema = new mongoose.Schema<ISettings>({
  officeStartTime: { type: String, default: "09:00" },
  officeEndTime: { type: String, default: "18:00" },
  weeklyOffs: { type: [String], default: ["Sunday"] },
  geoFenceEnabled: { type: Boolean, default: false },
  geoFenceRadius: { type: Number, default: 100 },
  ipRestrictionEnabled: { type: Boolean, default: false },
  allowedIPs: { type: String, default: "" },
}, { timestamps: true });

export default (mongoose.models.Settings as mongoose.Model<ISettings>) || mongoose.model<ISettings>('Settings', SettingsSchema);
