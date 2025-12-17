// app/api/reports/attendance/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import Attendance from "@/model/Attendance";
import User from "@/model/User";
import Employee from "@/model/Employee";

export async function GET(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const department = searchParams.get("department");

    if (!startDate || !endDate) {
      return NextResponse.json({ error: "Start date and end date required" }, { status: 400 });
    }

    const query: any = {
      date: { $gte: startDate, $lte: endDate },
    };

    // If department filter, get employee IDs first
    let userIds: any[] = [];
    if (department) {
      const employees = await Employee.find({ department }).lean();
      userIds = employees.map((e: any) => e.userId);
      query.userId = { $in: userIds };
    }

    const attendance = await Attendance.find(query)
      .populate("userId", "name email")
      .sort({ date: 1, userId: 1 })
      .lean();

    // Get employee details for department filter
    const employees = await Employee.find(department ? { department } : {}).lean();
    const employeeMap: any = {};
    employees.forEach((emp: any) => {
      employeeMap[emp.userId.toString()] = emp;
    });

    // Enrich with employee data
    const enriched = attendance.map((att: any) => ({
      ...att,
      employee: employeeMap[att.userId._id.toString()] || {},
    }));

    // Summary statistics
    const summary = {
      totalRecords: enriched.length,
      present: enriched.filter((a: any) => a.status === "Present").length,
      absent: enriched.filter((a: any) => a.status === "Absent").length,
      wfh: enriched.filter((a: any) => a.status === "WFH").length,
      onDuty: enriched.filter((a: any) => a.status === "OnDuty").length,
      totalHours: enriched.reduce((sum: number, a: any) => sum + (a.totalHours || 0), 0),
    };

    return NextResponse.json({
      attendance: enriched,
      summary,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

