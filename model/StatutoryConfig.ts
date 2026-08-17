// model/StatutoryConfig.ts
//
// India statutory rates, versioned by financial year and state.
//
// Nothing statutory is hardcoded anywhere else in this codebase. The Union
// Budget moves tax slabs every February, PF and ESI ceilings change
// periodically, and Professional Tax differs in every state. When rates
// change you seed a new row for the financial year — you do not ship code.
//
// A payroll run reads the config effective on its pay date, which is also
// what makes recomputing a past month give the same answer it gave then.
//
// ALL MONEY IS INTEGER PAISE.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export interface IPtSlab {
  /** Monthly gross lower bound, inclusive, in paise. */
  from: number;
  /** Upper bound, inclusive. null means no upper bound. */
  to: number | null;
  /** Monthly professional tax, in paise. */
  amount: number;
}

export interface ITaxSlab {
  /** Annual taxable income lower bound, inclusive, in paise. */
  from: number;
  to: number | null;
  /** Percentage, e.g. 5 for 5%. */
  rate: number;
}

export interface IStatutoryConfig {
  orgId: mongoose.Types.ObjectId;
  /** e.g. "2026-27". */
  financialYear: string;

  pf: {
    enabled: boolean;
    employeeRate: number; // percent of PF wage
    employerRate: number;
    /** Portion of the employer share that goes to the pension scheme. */
    epsRate: number;
    /** Monthly wage ceiling in paise. */
    wageCeiling: number;
    /** Cap contributions at the ceiling, or compute on actual basic. */
    restrictToCeiling: boolean;
    edliRate: number;
    adminRate: number;
  };

  esi: {
    enabled: boolean;
    /** Monthly gross at or below which ESI applies, in paise. */
    grossThreshold: number;
    employeeRate: number;
    employerRate: number;
  };

  /** Professional tax slabs, keyed by state — they differ in every one. */
  professionalTax: {
    enabled: boolean;
    state: string;
    slabs: IPtSlab[];
    /** Annual cap, in paise. Statutory maximum is ₹2,500. */
    annualCap: number;
  };

  incomeTax: {
    /** New regime is the default since FY 2023-24. */
    defaultRegime: "old" | "new";
    standardDeductionNew: number;
    standardDeductionOld: number;
    newRegimeSlabs: ITaxSlab[];
    oldRegimeSlabs: ITaxSlab[];
    cessRate: number;
  };

  /**
   * Labour Welfare Fund. State-specific, small, and rarely monthly — most
   * states deduct half-yearly or annually, so the months it applies in are
   * part of the config rather than assumed.
   */
  lwf: {
    enabled: boolean;
    state: string;
    /** Employee share per deduction cycle, in paise. */
    employeeAmount: number;
    employerAmount: number;
    /** Calendar months (1-12) in which the deduction is taken. */
    deductionMonths: number[];
  };

  gratuity: {
    enabled: boolean;
    minimumYears: number;
    /** Statutory cap, in paise. */
    cap: number;
    /** Days of wages per completed year. The Act's formula is 15/26. */
    daysPerYear: number;
    monthDays: number;
  };

  deletedAt?: Date | null;
}

const PtSlabSchema = new Schema<IPtSlab>(
  { from: Number, to: { type: Number, default: null }, amount: Number },
  { _id: false }
);

const TaxSlabSchema = new Schema<ITaxSlab>(
  { from: Number, to: { type: Number, default: null }, rate: Number },
  { _id: false }
);

const StatutoryConfigSchema = new Schema<IStatutoryConfig>(
  {
    financialYear: { type: String, required: true, trim: true },

    pf: {
      enabled: { type: Boolean, default: true },
      employeeRate: { type: Number, default: 12 },
      employerRate: { type: Number, default: 12 },
      epsRate: { type: Number, default: 8.33 },
      wageCeiling: { type: Number, default: 15_000_00 },
      restrictToCeiling: { type: Boolean, default: true },
      edliRate: { type: Number, default: 0.5 },
      adminRate: { type: Number, default: 0.5 },
    },

    esi: {
      enabled: { type: Boolean, default: true },
      grossThreshold: { type: Number, default: 21_000_00 },
      employeeRate: { type: Number, default: 0.75 },
      employerRate: { type: Number, default: 3.25 },
    },

    professionalTax: {
      enabled: { type: Boolean, default: true },
      state: { type: String, default: "Karnataka" },
      slabs: { type: [PtSlabSchema], default: [] },
      annualCap: { type: Number, default: 2_500_00 },
    },

    incomeTax: {
      defaultRegime: { type: String, enum: ["old", "new"], default: "new" },
      standardDeductionNew: { type: Number, default: 75_000_00 },
      standardDeductionOld: { type: Number, default: 50_000_00 },
      newRegimeSlabs: { type: [TaxSlabSchema], default: [] },
      oldRegimeSlabs: { type: [TaxSlabSchema], default: [] },
      cessRate: { type: Number, default: 4 },
    },

    lwf: {
      enabled: { type: Boolean, default: true },
      state: { type: String, default: "Karnataka" },
      employeeAmount: { type: Number, default: 20_00 },
      employerAmount: { type: Number, default: 40_00 },
      // Karnataka deducts once a year, in December.
      deductionMonths: { type: [Number], default: [12] },
    },

    gratuity: {
      enabled: { type: Boolean, default: true },
      minimumYears: { type: Number, default: 5 },
      cap: { type: Number, default: 20_00_000_00 },
      daysPerYear: { type: Number, default: 15 },
      monthDays: { type: Number, default: 26 },
    },
  },
  {
    timestamps: true,
    activityLabel: (d: any) => `Statutory config FY ${d.financialYear}`,
  } as any
);

StatutoryConfigSchema.index(
  { orgId: 1, financialYear: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

StatutoryConfigSchema.plugin(tenantModel);

export default (mongoose.models.StatutoryConfig as mongoose.Model<IStatutoryConfig>) ||
  mongoose.model<IStatutoryConfig>("StatutoryConfig", StatutoryConfigSchema);
