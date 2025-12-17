// app/api/leave/apply/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Leave from "@/model/Leave";
import LeaveBalance from "@/model/LeaveBalance";
import Employee from "@/model/Employee";
import User from "@/model/User";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const {
      leaveType,
      fromDate,
      toDate,
      isHalfDay,
      halfDayType,
      reason,
      attachment,
    } = await req.json();

    if (!leaveType || !fromDate || !toDate || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    const from = new Date(fromDate);
    const to = new Date(toDate);

    if (from > to) {
      return NextResponse.json({ error: "From date must be before to date" }, { status: 400 });
    }

    // Calculate number of days (excluding weekends for now, can add holiday calendar later)
    let days = 0;
    const currentDate = new Date(from);
    while (currentDate <= to) {
      const dayOfWeek = currentDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Not Sunday (0) or Saturday (6)
        days++;
      }
      currentDate.setDate(currentDate.getDate() + 1);
    }

    if (isHalfDay) {
      days = 0.5;
    }

    // Check leave balance (unless LOP - Loss of Pay)
    if (leaveType !== "LOP") {
      const year = from.getFullYear();
      const balance = await LeaveBalance.findOne({
        userId: (user as any)._id,
        leaveType,
        year,
      });

      const availableBalance = balance?.balance || 0;
      if (availableBalance < days) {
        return NextResponse.json(
          {
            error: `Insufficient leave balance. Available: ${availableBalance}, Required: ${days}`,
          },
          { status: 400 }
        );
      }
    }

    // Get employee's manager
    const employee = await Employee.findOne({ userId: (user as any)._id });
    const managerId = employee?.managerId;

    // Get manager details for display
    let managerName = "Not Assigned";
    if (managerId) {
      const manager = await User.findById(managerId).lean();
      managerName = (manager as any)?.name || "Not Assigned";
    }

    // Create leave request
    const leave = await Leave.create({
      userId: (user as any)._id,
      leaveType,
      fromDate: from,
      toDate: to,
      isHalfDay: isHalfDay || false,
      halfDayType: isHalfDay ? halfDayType : undefined,
      reason,
      attachment,
      status: "Pending",
      approverId: managerId,
      appliedAt: new Date(),
    });

    return NextResponse.json({
      leave,
      managerName,
      days,
      message: `Leave request submitted. It will be reviewed by ${managerName}`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

