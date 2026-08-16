// model/EmploymentHistory.ts
//
// Append-only record of every change to an employee's role in the company:
// designation, department, location, manager, grade, employment type, status.
//
// This is the highest-value table in the schema and costs one write per
// change. Without it you can only ever answer "what is true now" — you lose
// promotion history, tenure-in-role, "what did the org look like in March",
// and the retro/arrears inputs payroll will need later.
//
// Nothing here is ever updated or deleted.

import mongoose, { Schema } from "mongoose";
import { tenantScope } from "@/lib/db/plugins";

export type ChangeType =
  | "joined"
  | "promotion"
  | "transfer"
  | "manager-change"
  | "designation-change"
  | "department-change"
  | "location-change"
  | "grade-change"
  | "employment-type-change"
  | "status-change"
  | "confirmation"
  | "exit";

export interface IEmploymentHistory {
  orgId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  changeType: ChangeType;
  field: string;
  oldValue?: any;
  newValue?: any;
  /** Denormalized labels so the timeline reads without extra lookups. */
  oldLabel?: string | null;
  newLabel?: string | null;
  effectiveFrom: Date;
  effectiveTo?: Date | null;
  reason?: string;
  changedBy?: mongoose.Types.ObjectId | null;
  changedByName?: string | null;
  createdAt: Date;
}

const EmploymentHistorySchema = new Schema<IEmploymentHistory>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    changeType: {
      type: String,
      enum: [
        "joined",
        "promotion",
        "transfer",
        "manager-change",
        "designation-change",
        "department-change",
        "location-change",
        "grade-change",
        "employment-type-change",
        "status-change",
        "confirmation",
        "exit",
      ],
      required: true,
    },
    field: { type: String, required: true },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    oldLabel: { type: String, default: null },
    newLabel: { type: String, default: null },
    effectiveFrom: { type: Date, required: true, default: () => new Date() },
    effectiveTo: { type: Date, default: null },
    reason: String,
    changedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    changedByName: { type: String, default: null },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    // Append-only: no soft delete, and its own writes are not activity-logged
    // (the underlying Employee change already produces an entry).
    skipActivityLog: true,
  } as any
);

// The employee's timeline, newest first
EmploymentHistorySchema.index({ orgId: 1, employeeId: 1, effectiveFrom: -1 });
// "Org as of date" reporting
EmploymentHistorySchema.index({ orgId: 1, changeType: 1, effectiveFrom: -1 });

EmploymentHistorySchema.plugin(tenantScope);

export default (mongoose.models.EmploymentHistory as mongoose.Model<IEmploymentHistory>) ||
  mongoose.model<IEmploymentHistory>("EmploymentHistory", EmploymentHistorySchema);
