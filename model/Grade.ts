// model/Grade.ts
//
// Compensation / seniority band. `level` gives grades a sortable hierarchy
// (L1 < L2 < L3) for reporting and, later, salary-structure eligibility.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export interface IGrade {
  orgId: mongoose.Types.ObjectId;
  name: string;
  code: string;
  level: number;
  description?: string;
  isActive: boolean;
  deletedAt?: Date | null;
}

const GradeSchema = new Schema<IGrade>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    level: { type: Number, required: true, default: 1 },
    description: String,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true, activityLabel: (d: any) => `${d.name} (L${d.level})` } as any
);

GradeSchema.index(
  { orgId: 1, code: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
GradeSchema.index({ orgId: 1, level: 1 });

GradeSchema.plugin(tenantModel);

export default (mongoose.models.Grade as mongoose.Model<IGrade>) ||
  mongoose.model<IGrade>("Grade", GradeSchema);
