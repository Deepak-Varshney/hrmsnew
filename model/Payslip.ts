// model/Payslip.ts
//
// One employee's pay for one month — and a permanent record, not a view.
//
// The employee's name, code, designation, PAN and bank tail are SNAPSHOTTED
// here rather than joined at read time. A payslip is a statutory document:
// reprinting last March's must produce exactly what was issued then, even if
// the person has since been promoted, moved team, changed bank, or left.
//
// ALL MONEY IS INTEGER PAISE.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export interface IPayslipLine {
  code: string;
  name: string;
  amount: number;
  /** Statutory lines are computed; the rest come from the salary structure. */
  isStatutory?: boolean;
}

export interface IPayslip {
  orgId: mongoose.Types.ObjectId;
  payrollRunId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  /** "YYYY-MM". */
  month: string;
  financialYear: string;

  /** Frozen at generation — see the note above. */
  snapshot: {
    employeeCode: string;
    displayName: string;
    designation?: string | null;
    department?: string | null;
    location?: string | null;
    dateOfJoining?: Date | null;
    pan?: string | null;
    uan?: string | null;
    bankName?: string | null;
    /** Last four digits only. The full number never belongs on a payslip. */
    bankAccountTail?: string | null;
  };

  attendance: {
    workingDays: number;
    paidDays: number;
    lopDays: number;
    leaveDays: number;
  };

  earnings: IPayslipLine[];
  deductions: IPayslipLine[];
  /** Employer-side costs. Shown on the CTC view, not deducted from net. */
  employerContributions: IPayslipLine[];

  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;

  /** Net pay written out, as required on an Indian payslip. */
  netPayInWords: string;

  deletedAt?: Date | null;
}

const LineSchema = new Schema<IPayslipLine>(
  {
    code: { type: String, required: true, uppercase: true },
    name: { type: String, required: true },
    amount: { type: Number, required: true },
    isStatutory: { type: Boolean, default: false },
  },
  { _id: false }
);

const PayslipSchema = new Schema<IPayslip>(
  {
    payrollRunId: {
      type: Schema.Types.ObjectId,
      ref: "PayrollRun",
      required: true,
      index: true,
    },
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    financialYear: { type: String, required: true },

    snapshot: {
      employeeCode: { type: String, required: true },
      displayName: { type: String, required: true },
      designation: { type: String, default: null },
      department: { type: String, default: null },
      location: { type: String, default: null },
      dateOfJoining: { type: Date, default: null },
      pan: { type: String, default: null },
      uan: { type: String, default: null },
      bankName: { type: String, default: null },
      bankAccountTail: { type: String, default: null },
    },

    attendance: {
      workingDays: { type: Number, default: 0 },
      paidDays: { type: Number, default: 0 },
      lopDays: { type: Number, default: 0 },
      leaveDays: { type: Number, default: 0 },
    },

    earnings: { type: [LineSchema], default: [] },
    deductions: { type: [LineSchema], default: [] },
    employerContributions: { type: [LineSchema], default: [] },

    grossEarnings: { type: Number, default: 0 },
    totalDeductions: { type: Number, default: 0 },
    netPay: { type: Number, default: 0 },
    employerCost: { type: Number, default: 0 },

    netPayInWords: { type: String, default: "" },
  },
  {
    timestamps: true,
    activityLabel: (d: any) => `Payslip ${d.snapshot?.employeeCode} ${d.month}`,
  } as any
);

// One payslip per employee per month.
PayslipSchema.index(
  { orgId: 1, employeeId: 1, month: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
// The register for a run
PayslipSchema.index({ orgId: 1, payrollRunId: 1 });
// An employee's payslip history, newest first
PayslipSchema.index({ orgId: 1, employeeId: 1, month: -1 });

PayslipSchema.plugin(tenantModel);

export default (mongoose.models.Payslip as mongoose.Model<IPayslip>) ||
  mongoose.model<IPayslip>("Payslip", PayslipSchema);
