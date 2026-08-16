// lib/services/payrollQueries.ts
//
// Read paths for the Payroll page, scoped by role:
//
//   EMPLOYEE        own payslips only
//   LEAD / MANAGER  their subtree, read-only
//   ADMIN           the whole register, and may run payroll
//
// Called by the server component directly and by the API route, so the two
// cannot show different figures for the same month.

import Payslip from "@/model/Payslip";
import PayrollRun from "@/model/PayrollRun";
import { can, ownerFilterForScope } from "@/lib/rbac";
import { getContext } from "@/lib/context";

export interface PayslipSummaryRow {
  id: string;
  employeeId: string;
  employeeCode: string;
  displayName: string;
  designation: string | null;
  department: string | null;
  paidDays: number;
  workingDays: number;
  lopDays: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}

export interface PayrollTotals {
  grossEarnings: number;
  totalDeductions: number;
  netPayable: number;
  employerCost: number;
  payslipCount: number;
}

/** Months that have at least one payslip in scope, newest first. */
export async function availableMonths(): Promise<string[]> {
  const scope = can("payroll.read");
  const filter = await ownerFilterForScope(scope, "employeeId");
  const months: string[] = await Payslip.distinct("month", filter);
  return months.sort().reverse();
}

/**
 * The default month to show: the most recent one with payslips.
 *
 * Deliberately not the current month — payroll is generated after a month
 * closes, so landing on an empty "August" when July is the newest payslip
 * makes the page look broken.
 */
export async function defaultMonth(): Promise<string | null> {
  const months = await availableMonths();
  return months[0] ?? null;
}

export async function payrollForMonth(month: string) {
  const scope = can("payroll.read");
  const filter = { ...(await ownerFilterForScope(scope, "employeeId")), month };

  const [rows, run] = await Promise.all([
    Payslip.find(filter).sort({ "snapshot.employeeCode": 1 }).lean(),
    PayrollRun.findOne({ month }).lean(),
  ]);

  const payslips: PayslipSummaryRow[] = rows.map((p: any) => ({
    id: String(p._id),
    employeeId: String(p.employeeId),
    employeeCode: p.snapshot.employeeCode,
    displayName: p.snapshot.displayName,
    designation: p.snapshot.designation ?? null,
    department: p.snapshot.department ?? null,
    paidDays: p.attendance.paidDays,
    workingDays: p.attendance.workingDays,
    lopDays: p.attendance.lopDays,
    grossEarnings: p.grossEarnings,
    totalDeductions: p.totalDeductions,
    netPay: p.netPay,
  }));

  // Totals are summed over what this viewer can actually see, not copied
  // from the run — a lead's totals must cover their team, not the company.
  const totals: PayrollTotals = rows.reduce(
    (acc: PayrollTotals, p: any) => ({
      grossEarnings: acc.grossEarnings + p.grossEarnings,
      totalDeductions: acc.totalDeductions + p.totalDeductions,
      netPayable: acc.netPayable + p.netPay,
      employerCost: acc.employerCost + p.employerCost,
      payslipCount: acc.payslipCount + 1,
    }),
    { grossEarnings: 0, totalDeductions: 0, netPayable: 0, employerCost: 0, payslipCount: 0 }
  );

  return {
    payslips,
    totals,
    run: run
      ? {
          status: (run as any).status as string,
          approvedAt: (run as any).approvedAt ?? null,
          paidAt: (run as any).paidAt ?? null,
        }
      : null,
  };
}

/** The signed-in person's own payslip for a month, in full. */
export async function myPayslip(month: string) {
  const ctx = getContext();
  if (!ctx?.employeeId) return null;
  return Payslip.findOne({ employeeId: ctx.employeeId, month }).lean();
}

/** One payslip in full, if the viewer's scope allows it. */
export async function payslipById(id: string) {
  const scope = can("payroll.read");
  const filter = { ...(await ownerFilterForScope(scope, "employeeId")), _id: id };
  return Payslip.findOne(filter).lean();
}
