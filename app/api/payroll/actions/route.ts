// app/api/payroll/actions/route.ts
//
// Drives the payroll lifecycle: generate → approve → mark paid.
// Each transition is checked in the service, not here, so the same rules
// apply however they are invoked.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import {
  approvePayroll,
  generatePayroll,
  markPayrollPaid,
} from "@/lib/services/payrollRun";

export const POST = withContext(async (req) => {
  const { month, action } = await req.json();

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "A month like 2026-07 is required" }, { status: 400 });
  }

  switch (action) {
    case "generate": {
      const { run, skipped } = await generatePayroll(month);
      return NextResponse.json({
        status: run.status,
        totals: run.totals,
        // Surfaced rather than swallowed: an employee with no salary
        // structure is silently unpaid otherwise.
        skipped,
        message:
          skipped.length > 0
            ? `Generated. ${skipped.length} employee(s) skipped — no salary structure.`
            : "Payroll generated.",
      });
    }

    case "approve": {
      const run = await approvePayroll(month);
      return NextResponse.json({ status: run.status, message: "Payroll approved." });
    }

    case "paid": {
      const run = await markPayrollPaid(month);
      return NextResponse.json({ status: run.status, message: "Marked as paid." });
    }

    default:
      return NextResponse.json(
        { error: "action must be generate, approve or paid" },
        { status: 400 }
      );
  }
});
