// app/api/team/overview/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Employee from "@/model/Employee";
import User from "@/model/User";
import Attendance from "@/model/Attendance";
import Leave from "@/model/Leave";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    // Get all employees reporting to this manager
    const employees = await Employee.find({ managerId: (user as any)._id })
      .populate("userId", "name email role")
      .lean();

    const today = new Date().toISOString().split("T")[0];
    const teamMembers = await Promise.all(
      employees.map(async (emp: any) => {
        const userId = emp.userId._id;

        // Get today's attendance
        const attendance = await Attendance.findOne({ userId, date: today }).lean();
        
        // Check for active leave
        const activeLeave = await Leave.findOne({
          userId,
          status: "Approved",
          fromDate: { $lte: new Date() },
          toDate: { $gte: new Date() },
        }).lean();

        let status = "Absent";
        let statusColor = "text-red-500";
        let details = "";

        if (attendance && attendance.punches && attendance.punches.length > 0) {
          const lastPunch = attendance.punches[attendance.punches.length - 1];
          if (lastPunch.type === "IN") {
            status = "Present";
            statusColor = "text-emerald-500";
            details = `Checked in at ${new Date(lastPunch.time).toLocaleTimeString()}`;
          } else {
            status = "Checked Out";
            statusColor = "text-amber-500";
            details = `Checked out at ${new Date(lastPunch.time).toLocaleTimeString()}`;
          }
        } else if (activeLeave) {
          status = "On Leave";
          statusColor = "text-blue-500";
          details = `${activeLeave.leaveType} - ${new Date(activeLeave.fromDate).toLocaleDateString()} to ${new Date(activeLeave.toDate).toLocaleDateString()}`;
        }

        return {
          employeeId: userId,
          name: emp.userId.name,
          email: emp.userId.email,
          employeeCode: emp.employeeCode,
          department: emp.department,
          designation: emp.designation,
          status,
          statusColor,
          details,
          attendance: attendance
            ? {
                punches: attendance.punches?.length || 0,
                totalHours: attendance.totalHours || 0,
              }
            : null,
        };
      })
    );

    return NextResponse.json({ teamMembers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

