// app/api/employees/summary/route.ts
//
// Headcount figures for the Employees page and the dashboard.
//
// Each number ships with the parts it is made of, because a bare "2" on a
// screen makes the reader guess whether it counts leavers, contractors, or
// people still serving notice.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { can, employeeFilterForScope } from "@/lib/rbac";
import Employee from "@/model/Employee";
import Department from "@/model/Department";

export const GET = withContext(
  async () => {
    const scope = can("employee.read");
    const base = await employeeFilterForScope(scope);

    const [byStatus, byDepartment] = await Promise.all([
      Employee.aggregate([
        { $match: base },
        { $group: { _id: "$employment.status", count: { $sum: 1 } } },
      ]),
      Employee.aggregate([
        { $match: { ...base, "employment.status": { $ne: "exited" } } },
        { $group: { _id: "$departmentId", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 1 },
      ]),
    ]);

    const counts: Record<string, number> = {};
    for (const row of byStatus) counts[row._id ?? "unknown"] = row.count;

    const active = counts.active ?? 0;
    const probation = counts.probation ?? 0;
    const noticePeriod = counts["notice-period"] ?? 0;
    const onLeave = counts["on-leave"] ?? 0;
    const departed = counts.exited ?? 0;

    const onRoll = active + probation + noticePeriod + onLeave;
    const total = onRoll + departed;

    let largestTeam: { name: string; count: number } | null = null;
    if (byDepartment[0]?._id) {
      const dept = await Department.findById(byDepartment[0]._id).select("name").lean();
      if (dept) {
        largestTeam = { name: (dept as any).name, count: byDepartment[0].count };
      }
    }

    return NextResponse.json({
      summary: {
        onRoll,
        total,
        active,
        probation,
        noticePeriod,
        onLeave,
        departed,
        largestTeam,
      },
    });
  },
  { permission: "employee.read" }
);
