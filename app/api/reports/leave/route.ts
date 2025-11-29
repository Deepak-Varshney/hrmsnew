// app/api/reports/leave/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import Leave from "@/model/Leave";
import Employee from "@/model/Employee";

export async function GET(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const department = searchParams.get("department");
    const status = searchParams.get("status");

    const query: any = {};
    if (startDate && endDate) {
      query.$or = [
        { fromDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { toDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
      ];
    }
    if (status) {
      query.status = status;
    }

    // If department filter, get employee IDs first
    let userIds: any[] = [];
    if (department) {
      const employees = await Employee.find({ department }).lean();
      userIds = employees.map((e: any) => e.userId);
      query.userId = { $in: userIds };
    }

    const leaves = await Leave.find(query)
      .populate("userId", "name email")
      .populate("approverId", "name email")
      .sort({ fromDate: -1 })
      .lean();

    // Get employee details
    const employees = await Employee.find(department ? { department } : {}).lean();
    const employeeMap: any = {};
    employees.forEach((emp: any) => {
      employeeMap[emp.userId.toString()] = emp;
    });

    // Enrich with employee data
    const enriched = leaves.map((leave: any) => ({
      ...leave,
      employee: employeeMap[leave.userId._id.toString()] || {},
    }));

    // Summary statistics
    const summary = {
      total: enriched.length,
      pending: enriched.filter((l: any) => l.status === "Pending").length,
      approved: enriched.filter((l: any) => l.status === "Approved").length,
      rejected: enriched.filter((l: any) => l.status === "Rejected").length,
      byType: enriched.reduce((acc: any, l: any) => {
        acc[l.leaveType] = (acc[l.leaveType] || 0) + 1;
        return acc;
      }, {}),
    };

    return NextResponse.json({
      leaves: enriched,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

