// model/Location.ts
import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export interface ILocation {
  orgId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  type: "head-office" | "branch" | "site" | "remote";
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    /** Drives Professional Tax slabs once payroll ships. */
    state?: string;
    country?: string;
    pincode?: string;
  };
  timezone: string;
  /** Geofence for attendance check-in, once attendance is org-configurable. */
  geofence?: {
    enabled: boolean;
    latitude?: number;
    longitude?: number;
    radiusMeters?: number;
  };
  ipAllowlist?: string[];
  isActive: boolean;
  deletedAt?: Date | null;
}

const LocationSchema = new Schema<ILocation>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    type: {
      type: String,
      enum: ["head-office", "branch", "site", "remote"],
      default: "branch",
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: { type: String, default: "India" },
      pincode: String,
    },
    timezone: { type: String, default: "Asia/Kolkata" },
    geofence: {
      enabled: { type: Boolean, default: false },
      latitude: Number,
      longitude: Number,
      radiusMeters: { type: Number, default: 200 },
    },
    ipAllowlist: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, activityLabel: (d: any) => `${d.name} (${d.code})` } as any
);

LocationSchema.index(
  { orgId: 1, code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

LocationSchema.plugin(tenantModel);

export default (mongoose.models.Location as mongoose.Model<ILocation>) ||
  mongoose.model<ILocation>("Location", LocationSchema);
