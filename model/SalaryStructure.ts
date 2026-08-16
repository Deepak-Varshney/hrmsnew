// model/SalaryStructure.ts
//
// An employee's pay, versioned by effective date. A revision closes the
// previous row rather than overwriting it, because payroll for a past month
// must be recomputable from the structure that applied *then* — that is what
// arrears and retro corrections depend on.
//
// ALL MONEY IS INTEGER PAISE. Never floats: 0.1 + 0.2 !== 0.3, and a rounding
// drift of one paisa across a few thousand payslips is a reconciliation
// failure someone has to explain.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export type ComponentType = "earning" | "deduction";

export interface ISalaryComponentLine {
  code: string;
  name: string;
  type: ComponentType;
  /** Monthly value in paise. */
  monthly: number;
  /** Counted in CTC (employer contributions are, take-home deductions are not). */
  partOfCtc: boolean;
  taxable: boolean;
  /** Statutory lines are computed, not entered by hand. */
  isStatutory: boolean;
}

export interface ISalaryStructure {
  orgId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;

  /** Annual cost to company, in paise. */
  annualCtc: number;
  /** Monthly gross earnings before deductions, in paise. */
  monthlyGross: number;

  components: ISalaryComponentLine[];

  effectiveFrom: Date;
  /** null while this is the live structure. */
  effectiveTo: Date | null;
  revisionReason?: string;

  deletedAt?: Date | null;
}

const ComponentLineSchema = new Schema<ISalaryComponentLine>(
  {
    code: { type: String, required: true, uppercase: true, trim: true },
    name: { type: String, required: true },
    type: { type: String, enum: ["earning", "deduction"], required: true },
    monthly: { type: Number, required: true, min: 0 },
    partOfCtc: { type: Boolean, default: true },
    taxable: { type: Boolean, default: true },
    isStatutory: { type: Boolean, default: false },
  },
  { _id: false }
);

const SalaryStructureSchema = new Schema<ISalaryStructure>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    annualCtc: { type: Number, required: true, min: 0 },
    monthlyGross: { type: Number, required: true, min: 0 },
    components: { type: [ComponentLineSchema], default: [] },
    effectiveFrom: { type: Date, required: true },
    effectiveTo: { type: Date, default: null },
    revisionReason: String,
  },
  {
    timestamps: true,
    activityLabel: (d: any) => `Salary structure from ${d.effectiveFrom?.toISOString?.().slice(0, 10)}`,
  } as any
);

// The live structure for an employee, and history lookups by date.
SalaryStructureSchema.index({ orgId: 1, employeeId: 1, effectiveFrom: -1 });
SalaryStructureSchema.index({ orgId: 1, employeeId: 1, effectiveTo: 1 });

SalaryStructureSchema.plugin(tenantModel);

export default (mongoose.models.SalaryStructure as mongoose.Model<ISalaryStructure>) ||
  mongoose.model<ISalaryStructure>("SalaryStructure", SalaryStructureSchema);
