// lib/services/payroll.ts
//
// India payroll computation.
//
// ALL MONEY IS INTEGER PAISE. Rupee amounts are only produced at the edges,
// for display. Statutory rounding is applied where the rules require it —
// PF and TDS to the nearest rupee, ESI always up — because a payslip that
// disagrees with the challan by a rupee is a reconciliation problem.
//
// ⚠ THIS ENGINE IS NOT CA-VERIFIED.
// The structure is right and the rates are config-driven, but before any real
// customer runs live payroll a practising chartered accountant must validate
// the output against actual payslips, and the slabs in StatutoryConfig must be
// checked against the current Finance Act. Errors here become legal notices.

import mongoose from "mongoose";
import StatutoryConfig, { type IStatutoryConfig } from "@/model/StatutoryConfig";
import SalaryStructure from "@/model/SalaryStructure";
import Payslip, { type IPayslipLine } from "@/model/Payslip";
import PayrollRun from "@/model/PayrollRun";
import Employee from "@/model/Employee";
import { requireOrgId } from "@/lib/context";

// --- money helpers ---------------------------------------------------------

export const RUPEE = 100; // paise in a rupee

/** Nearest rupee, in paise. */
export const roundToRupee = (paise: number) => Math.round(paise / RUPEE) * RUPEE;
/** Next whole rupee, in paise. ESI is always rounded up. */
export const ceilToRupee = (paise: number) => Math.ceil(paise / RUPEE) * RUPEE;

const pct = (amount: number, rate: number) => (amount * rate) / 100;

export function formatINR(paise: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(paise / RUPEE);
}

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = ["", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety"];

function twoDigits(n: number): string {
  if (n < 20) return ONES[n];
  return `${TENS[Math.floor(n / 10)]}${n % 10 ? ` ${ONES[n % 10]}` : ""}`;
}

/** Indian numbering — crore, lakh, thousand. Required on a payslip. */
export function amountInWords(paise: number): string {
  const rupees = Math.round(paise / RUPEE);
  if (rupees === 0) return "Zero Rupees Only";

  const parts: string[] = [];
  const crore = Math.floor(rupees / 1_00_00_000);
  const lakh = Math.floor((rupees % 1_00_00_000) / 1_00_000);
  const thousand = Math.floor((rupees % 1_00_000) / 1_000);
  const rest = rupees % 1_000;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (rest) {
    const hundreds = Math.floor(rest / 100);
    const remainder = rest % 100;
    if (hundreds) parts.push(`${ONES[hundreds]} Hundred`);
    if (remainder) parts.push(twoDigits(remainder));
  }

  return `${parts.join(" ")} Rupees Only`;
}

// --- financial year --------------------------------------------------------

/** India's financial year runs April to March. "2026-27" for 16 Aug 2026. */
export function financialYearFor(date: Date): string {
  const year = date.getFullYear();
  const startYear = date.getMonth() >= 3 ? year : year - 1; // month 3 = April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`;
}

export function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

// --- statutory computation -------------------------------------------------

export interface PayInputs {
  /** Earnings from the salary structure, already pro-rated for LOP. */
  earnings: IPayslipLine[];
  /** Basic + DA for the month, in paise. The base for PF. */
  pfWage: number;
  monthlyGross: number;
  /** Annual taxable income projection, in paise. */
  annualTaxable: number;
  regime: "old" | "new";
}

export interface StatutoryResult {
  employeeDeductions: IPayslipLine[];
  employerContributions: IPayslipLine[];
}

/**
 * Provident Fund.
 *
 * Employee pays 12% of PF wage. The employer's matching 12% splits: 8.33% of
 * the wage *capped at the ceiling* goes to the pension scheme (EPS), and the
 * remainder to EPF. Getting that split wrong is the most common PF bug —
 * EPS is capped even when the employer contributes on actual basic.
 */
function computePf(config: IStatutoryConfig, pfWage: number) {
  const { pf } = config;
  if (!pf.enabled || pfWage <= 0) {
    return { employee: 0, employerEpf: 0, employerEps: 0, edli: 0, admin: 0 };
  }

  const base = pf.restrictToCeiling ? Math.min(pfWage, pf.wageCeiling) : pfWage;
  const epsBase = Math.min(base, pf.wageCeiling);

  const employee = roundToRupee(pct(base, pf.employeeRate));
  const employerTotal = roundToRupee(pct(base, pf.employerRate));
  const employerEps = roundToRupee(pct(epsBase, pf.epsRate));
  const employerEpf = Math.max(0, employerTotal - employerEps);

  return {
    employee,
    employerEpf,
    employerEps,
    edli: roundToRupee(pct(epsBase, pf.edliRate)),
    admin: roundToRupee(pct(base, pf.adminRate)),
  };
}

/**
 * ESI applies only at or below the gross threshold, and both shares are
 * rounded UP to the next rupee.
 */
function computeEsi(config: IStatutoryConfig, monthlyGross: number) {
  const { esi } = config;
  if (!esi.enabled || monthlyGross > esi.grossThreshold) {
    return { employee: 0, employer: 0, applicable: false };
  }
  return {
    employee: ceilToRupee(pct(monthlyGross, esi.employeeRate)),
    employer: ceilToRupee(pct(monthlyGross, esi.employerRate)),
    applicable: true,
  };
}

/** Professional tax — a flat monthly amount from the state's slab table. */
function computeProfessionalTax(config: IStatutoryConfig, monthlyGross: number) {
  const { professionalTax: ptConfig } = config;
  if (!ptConfig.enabled) return 0;

  const slab = ptConfig.slabs.find(
    (s) => monthlyGross >= s.from && (s.to === null || monthlyGross <= s.to)
  );
  return slab?.amount ?? 0;
}

/** Slab tax on an annual taxable figure, plus health and education cess. */
function computeAnnualTax(config: IStatutoryConfig, annualTaxable: number, regime: "old" | "new") {
  const slabs =
    regime === "new" ? config.incomeTax.newRegimeSlabs : config.incomeTax.oldRegimeSlabs;

  let tax = 0;
  for (const slab of slabs) {
    if (annualTaxable <= slab.from) break;
    const upper = slab.to === null ? annualTaxable : Math.min(annualTaxable, slab.to);
    tax += pct(upper - slab.from, slab.rate);
  }

  return roundToRupee(tax + pct(tax, config.incomeTax.cessRate));
}

export function computeStatutory(
  config: IStatutoryConfig,
  inputs: PayInputs
): StatutoryResult {
  const employeeDeductions: IPayslipLine[] = [];
  const employerContributions: IPayslipLine[] = [];

  const pf = computePf(config, inputs.pfWage);
  if (pf.employee > 0) {
    employeeDeductions.push({
      code: "PF",
      name: "Provident Fund",
      amount: pf.employee,
      isStatutory: true,
    });
    employerContributions.push(
      { code: "PF_EPF", name: "Employer PF", amount: pf.employerEpf, isStatutory: true },
      { code: "PF_EPS", name: "Employer Pension (EPS)", amount: pf.employerEps, isStatutory: true },
      { code: "PF_EDLI", name: "EDLI", amount: pf.edli, isStatutory: true },
      { code: "PF_ADMIN", name: "PF admin charges", amount: pf.admin, isStatutory: true }
    );
  }

  const esi = computeEsi(config, inputs.monthlyGross);
  if (esi.applicable) {
    employeeDeductions.push({
      code: "ESI",
      name: "ESI",
      amount: esi.employee,
      isStatutory: true,
    });
    employerContributions.push({
      code: "ESI_EMPLOYER",
      name: "Employer ESI",
      amount: esi.employer,
      isStatutory: true,
    });
  }

  const pt = computeProfessionalTax(config, inputs.monthlyGross);
  if (pt > 0) {
    employeeDeductions.push({
      code: "PT",
      name: "Professional Tax",
      amount: pt,
      isStatutory: true,
    });
  }

  // Annual liability spread evenly across the year. A real implementation
  // recomputes the remaining months on every revision, bonus, or regime
  // change rather than assuming twelve equal instalments.
  const standardDeduction =
    inputs.regime === "new"
      ? config.incomeTax.standardDeductionNew
      : config.incomeTax.standardDeductionOld;

  const taxable = Math.max(0, inputs.annualTaxable - standardDeduction);
  const annualTax = computeAnnualTax(config, taxable, inputs.regime);
  const monthlyTds = roundToRupee(annualTax / 12);

  if (monthlyTds > 0) {
    employeeDeductions.push({
      code: "TDS",
      name: "Income Tax (TDS)",
      amount: monthlyTds,
      isStatutory: true,
    });
  }

  return { employeeDeductions, employerContributions };
}

// --- payslip generation ----------------------------------------------------

export interface AttendanceInput {
  workingDays: number;
  paidDays: number;
  lopDays: number;
  leaveDays: number;
}

/**
 * Build one payslip. Pure given its inputs — no database access — so it can
 * be unit-tested against CA-verified expected outputs.
 */
export function buildPayslip(params: {
  structure: { components: any[]; monthlyGross: number; annualCtc: number };
  attendance: AttendanceInput;
  config: IStatutoryConfig;
  regime?: "old" | "new";
}) {
  const { structure, attendance, config } = params;
  const regime = params.regime ?? config.incomeTax.defaultRegime;

  // Loss of pay reduces every earning proportionally.
  const ratio =
    attendance.workingDays > 0
      ? Math.min(1, attendance.paidDays / attendance.workingDays)
      : 1;

  const earnings: IPayslipLine[] = structure.components
    .filter((c) => c.type === "earning")
    .map((c) => ({
      code: c.code,
      name: c.name,
      amount: roundToRupee(c.monthly * ratio),
      isStatutory: false,
    }));

  const grossEarnings = earnings.reduce((sum, line) => sum + line.amount, 0);

  const basic = earnings.find((e) => e.code === "BASIC")?.amount ?? 0;
  const da = earnings.find((e) => e.code === "DA")?.amount ?? 0;
  const pfWage = basic + da;

  const { employeeDeductions, employerContributions } = computeStatutory(config, {
    earnings,
    pfWage,
    monthlyGross: grossEarnings,
    annualTaxable: grossEarnings * 12,
    regime,
  });

  // Non-statutory deductions carried on the structure (loans, recoveries).
  const otherDeductions: IPayslipLine[] = structure.components
    .filter((c) => c.type === "deduction" && !c.isStatutory)
    .map((c) => ({
      code: c.code,
      name: c.name,
      amount: roundToRupee(c.monthly),
      isStatutory: false,
    }));

  const deductions = [...employeeDeductions, ...otherDeductions];
  const totalDeductions = deductions.reduce((sum, line) => sum + line.amount, 0);
  const netPay = Math.max(0, grossEarnings - totalDeductions);
  const employerCost =
    grossEarnings + employerContributions.reduce((sum, line) => sum + line.amount, 0);

  return {
    earnings,
    deductions,
    employerContributions,
    grossEarnings,
    totalDeductions,
    netPay,
    employerCost,
    netPayInWords: amountInWords(netPay),
  };
}

// --- orchestration ---------------------------------------------------------

/** Statutory config for a financial year, or null if not configured. */
export async function getStatutoryConfig(financialYear: string) {
  return StatutoryConfig.findOne({ financialYear }).lean() as Promise<IStatutoryConfig | null>;
}

/** The salary structure in force on a given date. */
export async function structureOn(employeeId: string | mongoose.Types.ObjectId, date: Date) {
  return SalaryStructure.findOne({
    employeeId,
    effectiveFrom: { $lte: date },
    $or: [{ effectiveTo: null }, { effectiveTo: { $gte: date } }],
  })
    .sort({ effectiveFrom: -1 })
    .lean();
}

export interface PayrollRunSummary {
  month: string;
  status: string;
  totals: {
    grossEarnings: number;
    totalDeductions: number;
    netPayable: number;
    employerCost: number;
    employeeCount: number;
    payslipCount: number;
  };
}

/** The register for a month: the run plus every payslip in it. */
export async function payrollRegister(month: string) {
  const run = await PayrollRun.findOne({ month }).lean();
  if (!run) return { run: null, payslips: [] };

  const payslips = await Payslip.find({ payrollRunId: (run as any)._id })
    .sort({ "snapshot.employeeCode": 1 })
    .lean();

  return { run, payslips };
}

/** One employee's payslips, newest first — the employee's own Payroll page. */
export async function payslipsFor(employeeId: string, limit = 24) {
  return Payslip.find({ employeeId }).sort({ month: -1 }).limit(limit).lean();
}

export async function payslipForMonth(employeeId: string, month: string) {
  return Payslip.findOne({ employeeId, month }).lean();
}

/** Months that have a payslip for this employee, for the month picker. */
export async function availablePayslipMonths(employeeId: string): Promise<string[]> {
  const rows = await Payslip.find({ employeeId }).select("month").sort({ month: -1 }).lean();
  return rows.map((r: any) => r.month);
}
