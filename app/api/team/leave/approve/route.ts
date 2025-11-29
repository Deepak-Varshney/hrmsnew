// app/api/team/leave/approve/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Leave from "@/model/Leave";
import Employee from "@/model/Employee";
import LeaveBalance from "@/model/LeaveBalance";
import AuditLog from "@/model/AuditLog";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { leaveId, action, remarks } = await req.json(); // action: "approve" or "reject"

    if (!leaveId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify this leave belongs to a team member
    const leave = await Leave.findById(leaveId).populate("userId").lean();
    if (!leave) {
      return NextResponse.json({ error: "Leave request not found" }, { status: 404 });
    }

    const employee = await Employee.findOne({ userId: (leave as any).userId._id }).lean();
    if (!employee || employee.managerId?.toString() !== (user as any)._id.toString()) {
      return NextResponse.json({ error: "Unauthorized: Not your team member" }, { status: 403 });
    }

    // Update leave status
    const updateData: any = {
      status: action === "approve" ? "Approved" : "Rejected",
      approverRemarks: remarks || "",
      reviewedAt: new Date(),
    };

    await Leave.findByIdAndUpdate(leaveId, updateData);

    // If approved, update leave balance
    if (action === "approve" && (leave as any).leaveType !== "LOP") {
      const year = new Date((leave as any).fromDate).getFullYear();
      let days = 0;
      if ((leave as any).isHalfDay) {
        days = 0.5;
      } else {
        const from = new Date((leave as any).fromDate);
        const to = new Date((leave as any).toDate);
        const currentDate = new Date(from);
        while (currentDate <= to) {
          const dayOfWeek = currentDate.getDay();
          if (dayOfWeek !== 0 && dayOfWeek !== 6) {
            days++;
          }
          currentDate.setDate(currentDate.getDate() + 1);
        }
      }

      const balance = await LeaveBalance.findOne({
        userId: (leave as any).userId._id,
        leaveType: (leave as any).leaveType,
        year,
      });

      if (balance) {
        const oldUsed = balance.used;
        balance.used = (balance.used || 0) + days;
        balance.balance = balance.totalCredited - balance.used;
        balance.lastUpdated = new Date();
        balance.lastUpdatedBy = (user as any)._id;
        await balance.save();

        // Log audit
        await AuditLog.create({
          action: "leave_balance_update",
          userId: (user as any)._id,
          targetUserId: (leave as any).userId._id,
          entityType: "LeaveBalance",
          entityId: balance._id,
          oldValue: { used: oldUsed, balance: balance.totalCredited - oldUsed },
          newValue: { used: balance.used, balance: balance.balance },
          remarks: `Leave approved: ${(leave as any).leaveType} for ${days} days`,
        });
      }
    }

    // Log audit
    await AuditLog.create({
      action: `leave_${action}`,
      userId: (user as any)._id,
      targetUserId: (leave as any).userId._id,
      entityType: "Leave",
      entityId: leaveId,
      oldValue: { status: "Pending" },
      newValue: { status: updateData.status },
      remarks: remarks || "",
    });

    return NextResponse.json({
      success: true,
      message: `Leave request ${action === "approve" ? "approved" : "rejected"} successfully`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

