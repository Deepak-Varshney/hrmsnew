// app/api/team/leave/pending/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Leave from "@/model/Leave";
import Employee from "@/model/Employee";
import User from "@/model/User";
import LeaveBalance from "@/model/LeaveBalance";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    // Get team member IDs
    const employees = await Employee.find({ managerId: (user as any)._id }).lean();
    const teamMemberIds = employees.map((emp: any) => emp.userId);

    // Get pending leave requests for team
    const leaves = await Leave.find({
      userId: { $in: teamMemberIds },
      status: "Pending",
    })
      .populate("userId", "name email")
      .sort({ appliedAt: -1 })
      .lean();

    // Enrich with leave balance info
    const enrichedLeaves = await Promise.all(
      leaves.map(async (leave: any) => {
        const year = new Date(leave.fromDate).getFullYear();
        const balance = await LeaveBalance.findOne({
          userId: leave.userId._id,
          leaveType: leave.leaveType,
          year,
        }).lean();

        // Calculate days
        let days = 0;
        if (leave.isHalfDay) {
          days = 0.5;
        } else {
          const from = new Date(leave.fromDate);
          const to = new Date(leave.toDate);
          const currentDate = new Date(from);
          while (currentDate <= to) {
            const dayOfWeek = currentDate.getDay();
            if (dayOfWeek !== 0 && dayOfWeek !== 6) {
              days++;
            }
            currentDate.setDate(currentDate.getDate() + 1);
          }
        }

        return {
          ...leave,
          days,
          availableBalance: balance?.balance || 0,
        };
      })
    );

    return NextResponse.json({ leaves: enrichedLeaves });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

