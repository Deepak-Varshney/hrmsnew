// model/Department.ts
import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export interface IDepartment {
  orgId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description?: string;
  /** Departments nest: Engineering → Platform → Infra. */
  parentId?: mongoose.Types.ObjectId | null;
  headEmployeeId?: mongoose.Types.ObjectId | null;
  isActive: boolean;
  deletedAt?: Date | null;
}

const DepartmentSchema = new Schema<IDepartment>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    description: String,
    parentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    headEmployeeId: { type: Schema.Types.ObjectId, ref: "Employee", default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, activityLabel: (d: any) => `${d.name} (${d.code})` } as any
);

DepartmentSchema.index(
  { orgId: 1, code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
DepartmentSchema.index({ orgId: 1, parentId: 1 });

DepartmentSchema.plugin(tenantModel);

export default (mongoose.models.Department as mongoose.Model<IDepartment>) ||
  mongoose.model<IDepartment>("Department", DepartmentSchema);
