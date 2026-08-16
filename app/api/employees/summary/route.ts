// app/api/employees/summary/route.ts
//
// Headcount for clients that fetch rather than server-render. The page itself
// calls employeeSummary() directly — same function, no HTTP hop.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { employeeSummary } from "@/lib/services/employeeQueries";

export const GET = withContext(
  async () => {
    return NextResponse.json({ summary: await employeeSummary() });
  },
  { permission: "employee.read" }
);
