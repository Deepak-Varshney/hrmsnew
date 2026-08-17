// app/api/payroll/bank-advice/route.ts
//
// NEFT/IMPS bulk upload file for the month.
//
// ⚠ The response body contains full bank account numbers in clear text. It is
// generated on demand, never cached, never written to disk, and every download
// is recorded as a critical activity by the service.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { bankAdviceCsv } from "@/lib/services/payrollRun";

export const GET = withContext(async (req) => {
  const month = new URL(req.url).searchParams.get("month");

  if (!month || !/^\d{4}-\d{2}$/.test(month)) {
    return NextResponse.json({ error: "A month like 2026-07 is required" }, { status: 400 });
  }

  const csv = await bankAdviceCsv(month);

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="bank-advice-${month}.csv"`,
      // Sensitive payload — keep it out of every cache between here and the
      // browser.
      "Cache-Control": "no-store, no-cache, must-revalidate, private",
    },
  });
});
