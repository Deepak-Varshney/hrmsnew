// app/api/team/attendance/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Employee from "@/model/Employee";
import Attendance from "@/model/Attendance";
import User from "@/model/User";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const employeeId = searchParams.get("employeeId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const month = searchParams.get("month");

    // Get team members
    const employees = await Employee.find({ managerId: (user as any)._id })
      .populate("userId", "name email")
      .lean();

    if (employees.length === 0) {
      return NextResponse.json({ attendance: [], employees: [] });
    }

    const employeeIds = employees.map((emp: any) => emp.userId._id);

    // If specific employee requested, filter
    let queryEmployeeIds = employeeIds;
    if (employeeId && employeeIds.includes(employeeId as any)) {
      queryEmployeeIds = [employeeId as any];
    }

    const query: any = { userId: { $in: queryEmployeeIds } };

    if (month) {
      const [year, monthNum] = month.split("-");
      const start = `${year}-${monthNum}-01`;
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const end = `${year}-${monthNum}-${endDate.toString().padStart(2, "0")}`;
      query.date = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    } else {
      // Default to current month
      const now = new Date();
      const year = now.getFullYear();
      const monthNum = (now.getMonth() + 1).toString().padStart(2, "0");
      const start = `${year}-${monthNum}-01`;
      const endDate = new Date(year, now.getMonth() + 1, 0).getDate();
      const end = `${year}-${monthNum}-${endDate.toString().padStart(2, "0")}`;
      query.date = { $gte: start, $lte: end };
    }

    const attendance = await Attendance.find(query)
      .populate("userId", "name email")
      .sort({ date: -1, userId: 1 })
      .lean();

    return NextResponse.json({
      attendance,
      employees: employees.map((emp: any) => ({
        id: emp.userId._id,
        name: emp.userId.name,
        email: emp.userId.email,
        employeeCode: emp.employeeCode,
      })),
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

