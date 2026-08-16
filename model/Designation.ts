// model/Designation.ts
//
// Job title — Associate, Executive, Developer, Sr. Developer, Team Lead.
//
// This is NOT a permission level. Permissions come from Membership.role
// (ADMIN / MANAGER / EMPLOYEE). A Developer can be a MANAGER; a Sr. Developer
// can be an EMPLOYEE. Keep the two concepts apart.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export interface IDesignation {
  orgId: mongoose.Types.ObjectId;
  title: string;
  code: string;
  description?: string;
  gradeId?: mongoose.Types.ObjectId | null;
  departmentId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  deletedAt?: Date | null;
}

const DesignationSchema = new Schema<IDesignation>(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: String,
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null },
    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, activityLabel: (d: any) => d.title } as any
);

DesignationSchema.index(
  { orgId: 1, code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

DesignationSchema.plugin(tenantModel);

export default (mongoose.models.Designation as mongoose.Model<IDesignation>) ||
  mongoose.model<IDesignation>("Designation", DesignationSchema);
