// lib/services/payrollRun.ts
//
// Running payroll: generate → approve → mark paid, plus the bank advice file.
//
// A run is freely regenerable while it is a draft and frozen once approved.
// Corrections after approval belong in a later run as an adjustment, so the
// register still reconciles with what actually left the bank account.

import mongoose from "mongoose";
import Employee from "@/model/Employee";
import Attendance from "@/model/Attendance";
import Leave from "@/model/Leave";
import SalaryStructure from "@/model/SalaryStructure";
import PayrollRun from "@/model/PayrollRun";
import Payslip from "@/model/Payslip";
import StatutoryConfig from "@/model/StatutoryConfig";
import { requireOrgId, getContext } from "@/lib/context";
import { assertCan } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { decryptField } from "@/lib/crypto";
import {
  buildPayslip,
  financialYearFor,
  roundToRupee,
  workingDaysInMonth,
} from "@/lib/services/payroll";

export class PayrollError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "PayrollError";
  }
}

/**
 * Overtime multiplier. The Factories Act requires twice the ordinary rate.
 * Should become an org setting alongside the late threshold.
 */
const OT_MULTIPLIER = 2;
const STANDARD_DAYS = 26;
const STANDARD_HOURS = 8;

function monthBounds(month: string) {
  const [year, m] = month.split("-").map(Number);
  return { year, monthIndex: m - 1, start: new Date(year, m - 1, 1), end: new Date(year, m, 0) };
}

/**
 * Generate or regenerate payroll for a month.
 *
 * Idempotent: re-running replaces the draft's payslips rather than appending,
 * so a correction to attendance can simply be followed by another run.
 */
export async function generatePayroll(month: string) {
  await assertCan("payroll.run");
  const orgId = requireOrgId();
  const ctx = getContext()!;

  const existing = await PayrollRun.findOne({ month });
  if (existing && ["approved", "paid"].includes(existing.status)) {
    throw new PayrollError(
      `Payroll for ${month} is already ${existing.status}. Post an adjustment in a later run instead of regenerating it.`
    );
  }

  const financialYear = financialYearFor(monthBounds(month).start);
  const config: any = await StatutoryConfig.findOne({ financialYear }).lean();
  if (!config) {
    throw new PayrollError(
      `No statutory configuration for FY ${financialYear}. Add the year's PF, ESI, PT and tax rates before running payroll.`
    );
  }

  const run =
    existing ??
    (await PayrollRun.create({ orgId, month, financialYear, status: "draft" }));

  // A regenerated draft starts clean.
  await Payslip.deleteMany({ payrollRunId: run._id });

  const { start, end } = monthBounds(month);
  const workingDays = workingDaysInMonth(month);

  const employees: any[] = await Employee.find({
    "employment.status": { $ne: "exited" },
    "employment.dateOfJoining": { $lte: end },
  })
    .populate("designationId", "title")
    .populate("departmentId", "name")
    .populate("locationId", "name");

  const totals = {
    grossEarnings: 0,
    totalDeductions: 0,
    netPayable: 0,
    employerCost: 0,
    employeeCount: 0,
    payslipCount: 0,
  };

  const skipped: string[] = [];

  for (const employee of employees) {
    const structure: any = await SalaryStructure.findOne({
      employeeId: employee._id,
      effectiveFrom: { $lte: end },
      $or: [{ effectiveTo: null }, { effectiveTo: { $gte: start } }],
    })
      .sort({ effectiveFrom: -1 })
      .lean();

    if (!structure) {
      skipped.push(employee.employeeCode);
      continue;
    }

    // Attendance for the month.
    const rows: any[] = await Attendance.find({
      orgId,
      userId: employee.userId,
      date: { $regex: `^${month}` },
    }).lean();

    const absentFromAttendance = rows.filter((r) => r.status === "Absent").length;
    const presentDays = rows.length - absentFromAttendance;

    // Approved unpaid leave also costs pay. Without this the payslip
    // silently pays people for LOP they were granted.
    const unpaidLeaves: any[] = await Leave.find({
      orgId,
      userId: employee.userId,
      status: "Approved",
      leaveType: "LOP",
      fromDate: { $lte: end },
      toDate: { $gte: start },
    }).lean();

    const lopFromLeave = unpaidLeaves.reduce((sum, leave) => {
      const from = new Date(Math.max(new Date(leave.fromDate).getTime(), start.getTime()));
      const to = new Date(Math.min(new Date(leave.toDate).getTime(), end.getTime()));
      const days = Math.floor((to.getTime() - from.getTime()) / 864e5) + 1;
      return sum + Math.max(0, days);
    }, 0);

    const lopDays = absentFromAttendance + lopFromLeave;
    const paidDays = Math.max(0, workingDays - lopDays);

    // Overtime: hours logged beyond a standard day, paid at the statutory
    // multiple of the basic hourly rate.
    const basicMonthly =
      structure.components.find((c: any) => c.code === "BASIC")?.monthly ?? 0;
    const hourlyRate = basicMonthly / (STANDARD_DAYS * STANDARD_HOURS);

    const overtimeHours = rows.reduce((sum, r) => {
      const hours = r.totalHours ?? 0;
      return sum + (hours > STANDARD_HOURS ? hours - STANDARD_HOURS : 0);
    }, 0);

    const overtimeAmount = roundToRupee(overtimeHours * hourlyRate * OT_MULTIPLIER);

    const computed = buildPayslip({
      structure,
      attendance: { workingDays, paidDays, lopDays, leaveDays: lopFromLeave },
      config,
      month,
      overtimeAmount,
    });

    await Payslip.create({
      orgId,
      payrollRunId: run._id,
      employeeId: employee._id,
      month,
      financialYear,
      snapshot: {
        employeeCode: employee.employeeCode,
        displayName: employee.displayName,
        designation: employee.designationId?.title ?? null,
        department: employee.departmentId?.name ?? null,
        location: employee.locationId?.name ?? null,
        dateOfJoining: employee.employment?.dateOfJoining ?? null,
        pan: employee.statutory?.pan ?? null,
        uan: employee.statutory?.uan ?? null,
        bankName: employee.bank?.bankName ?? null,
        // Only the tail is ever stored on a payslip.
        bankAccountTail: (employee.bank?.accountNumber ?? "").slice(-4) || null,
      },
      attendance: { workingDays, paidDays, lopDays, leaveDays: lopFromLeave },
      ...computed,
    });

    totals.grossEarnings += computed.grossEarnings;
    totals.totalDeductions += computed.totalDeductions;
    totals.netPayable += computed.netPay;
    totals.employerCost += computed.employerCost;
    totals.employeeCount += 1;
    totals.payslipCount += 1;
  }

  run.totals = totals;
  run.status = "computed";
  run.computedAt = new Date();
  run.computedBy = new mongoose.Types.ObjectId(ctx.userId) as any;
  await run.save();

  await logActivity({
    action: "payroll.generated",
    entityType: "PayrollRun",
    entityId: run._id,
    entityLabel: `Payroll ${month}`,
    metadata: { month, ...totals, skipped },
    severity: "warning",
  });

  return { run, skipped };
}

export async function approvePayroll(month: string) {
  await assertCan("payroll.approve");
  const ctx = getContext()!;

  const run = await PayrollRun.findOne({ month });
  if (!run) throw new PayrollError(`No payroll run for ${month}.`);
  if (run.status === "draft") {
    throw new PayrollError("Generate the payroll before approving it.");
  }
  if (run.status !== "computed") {
    throw new PayrollError(`Payroll for ${month} is already ${run.status}.`);
  }

  run.status = "approved";
  run.approvedAt = new Date();
  run.approvedBy = new mongoose.Types.ObjectId(ctx.userId) as any;
  await run.save();

  await logActivity({
    action: "payroll.approved",
    entityType: "PayrollRun",
    entityId: run._id,
    entityLabel: `Payroll ${month}`,
    metadata: { month, netPayable: run.totals.netPayable },
    severity: "critical",
  });

  return run;
}

export async function markPayrollPaid(month: string) {
  await assertCan("payroll.approve");

  const run = await PayrollRun.findOne({ month });
  if (!run) throw new PayrollError(`No payroll run for ${month}.`);
  if (run.status !== "approved") {
    throw new PayrollError("Approve the payroll before marking it paid.");
  }

  run.status = "paid";
  run.paidAt = new Date();
  await run.save();

  await logActivity({
    action: "payroll.paid",
    entityType: "PayrollRun",
    entityId: run._id,
    entityLabel: `Payroll ${month}`,
    severity: "critical",
  });

  return run;
}

/**
 * Bank advice file for a NEFT/IMPS bulk upload.
 *
 * ⚠ This file contains full bank account numbers in clear text — it is the
 * single most sensitive export in the product. Generating it requires
 * approval to have happened, is recorded as a critical activity, and the
 * result should never be written to disk on the server.
 */
export async function bankAdviceCsv(month: string): Promise<string> {
  await assertCan("payroll.approve");
  const orgId = requireOrgId();

  const run = await PayrollRun.findOne({ month });
  if (!run) throw new PayrollError(`No payroll run for ${month}.`);
  if (!["approved", "paid"].includes(run.status)) {
    throw new PayrollError(
      "Approve the payroll before generating a bank file. Paying against an unapproved run is how duplicate transfers happen."
    );
  }

  const payslips: any[] = await Payslip.find({ payrollRunId: run._id })
    .sort({ "snapshot.employeeCode": 1 })
    .lean();

  const employees: any[] = await Employee.find({
    _id: { $in: payslips.map((p) => p.employeeId) },
  })
    .select("bank employeeCode displayName")
    .lean();

  const bankByEmployee = new Map(employees.map((e) => [String(e._id), e.bank]));

  const header = [
    "Beneficiary Name",
    "Account Number",
    "IFSC",
    "Amount",
    "Payment Mode",
    "Narration",
  ];

  const rows = payslips.map((p) => {
    const bank = bankByEmployee.get(String(p.employeeId)) ?? {};
    // .lean() bypasses the decrypting getter, so decrypt explicitly.
    const account = decryptField(bank.accountNumber) ?? "";
    const amountRupees = (p.netPay / 100).toFixed(2);

    return [
      bank.accountHolderName || p.snapshot.displayName,
      account,
      bank.ifsc ?? "",
      amountRupees,
      "NEFT",
      `Salary ${month} ${p.snapshot.employeeCode}`,
    ];
  });

  await logActivity({
    action: "data.exported",
    entityType: "PayrollRun",
    entityId: run._id,
    entityLabel: `Bank advice ${month}`,
    metadata: { month, rows: rows.length, contains: "full bank account numbers" },
    severity: "critical",
  });

  const escape = (value: string) =>
    /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

  return [header, ...rows].map((r) => r.map(String).map(escape).join(",")).join("\r\n");
}
