// model/PayrollRun.ts
//
// One payroll cycle for one month.
//
// The lifecycle matters more than the fields: a run is freely recomputable
// while it is a draft, and immutable once approved. Corrections after
// approval go through an explicit adjustment in a later run rather than a
// silent edit — otherwise the register no longer reconciles with what was
// actually paid into people's accounts.
//
//   draft → computed → approved → paid
//
// ALL MONEY IS INTEGER PAISE.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export type PayrollStatus = "draft" | "computed" | "approved" | "paid";

export interface IPayrollRun {
  orgId: mongoose.Types.ObjectId;
  /** "YYYY-MM". One run per org per month. */
  month: string;
  financialYear: string;
  status: PayrollStatus;

  totals: {
    grossEarnings: number;
    totalDeductions: number;
    netPayable: number;
    employerCost: number;
    employeeCount: number;
    payslipCount: number;
  };

  computedAt?: Date | null;
  computedBy?: mongoose.Types.ObjectId | null;
  approvedAt?: Date | null;
  approvedBy?: mongoose.Types.ObjectId | null;
  paidAt?: Date | null;

  notes?: string;
  deletedAt?: Date | null;
}

const PayrollRunSchema = new Schema<IPayrollRun>(
  {
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    financialYear: { type: String, required: true },
    status: {
      type: String,
      enum: ["draft", "computed", "approved", "paid"],
      default: "draft",
      index: true,
    },

    totals: {
      grossEarnings: { type: Number, default: 0 },
      totalDeductions: { type: Number, default: 0 },
      netPayable: { type: Number, default: 0 },
      employerCost: { type: Number, default: 0 },
      employeeCount: { type: Number, default: 0 },
      payslipCount: { type: Number, default: 0 },
    },

    computedAt: { type: Date, default: null },
    computedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    approvedAt: { type: Date, default: null },
    approvedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    paidAt: { type: Date, default: null },

    notes: String,
  },
  {
    timestamps: true,
    activityLabel: (d: any) => `Payroll ${d.month}`,
  } as any
);

PayrollRunSchema.index(
  { orgId: 1, month: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

/** An approved run is a financial record — block edits to its figures. */
PayrollRunSchema.pre("save", function (this: any) {
  if (this.isNew) return;

  const locked = ["approved", "paid"];
  const previousStatus = this.$locals.__prev?.status;

  if (
    previousStatus &&
    locked.includes(previousStatus) &&
    (this.isModified("totals") || this.isModified("month"))
  ) {
    throw new Error(
      "This payroll run is approved. Post an adjustment in a later run rather than editing it."
    );
  }
});

PayrollRunSchema.plugin(tenantModel);

export default (mongoose.models.PayrollRun as mongoose.Model<IPayrollRun>) ||
  mongoose.model<IPayrollRun>("PayrollRun", PayrollRunSchema);
