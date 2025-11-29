// app/api/team/regularisation/approve/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Regularisation from "@/model/Regularisation";
import Employee from "@/model/Employee";
import Attendance from "@/model/Attendance";
import AuditLog from "@/model/AuditLog";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { regularisationId, action, remarks } = await req.json(); // action: "approve" or "reject"

    if (!regularisationId || !action) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify this regularisation belongs to a team member
    const regularisation = await Regularisation.findById(regularisationId)
      .populate("userId")
      .lean();
    if (!regularisation) {
      return NextResponse.json({ error: "Regularisation request not found" }, { status: 404 });
    }

    const employee = await Employee.findOne({
      userId: (regularisation as any).userId._id,
    }).lean();
    if (
      !employee ||
      employee.managerId?.toString() !== (user as any)._id.toString()
    ) {
      return NextResponse.json(
        { error: "Unauthorized: Not your team member" },
        { status: 403 }
      );
    }

    // Update regularisation status
    const updateData: any = {
      status: action === "approve" ? "Approved" : "Rejected",
      approverRemarks: remarks || "",
      reviewedAt: new Date(),
    };

    // If approved, update attendance
    if (action === "approve") {
      const { date, type } = regularisation as any;
      let attendance = await Attendance.findOne({
        userId: (regularisation as any).userId._id,
        date,
      });

      if (!attendance) {
        attendance = await Attendance.create({
          userId: (regularisation as any).userId._id,
          date,
          punches: [],
        });
      }

      // Update attendance based on type
      if (type === "Forgot Punch") {
        // Add default IN and OUT punches (9 AM to 6 PM)
        const dateObj = new Date(date + "T09:00:00");
        attendance.punches = [
          { type: "IN", time: dateObj },
          { type: "OUT", time: new Date(dateObj.getTime() + 9 * 60 * 60 * 1000) },
        ];
        attendance.totalHours = 9;
        attendance.status = "Present";
      } else if (type === "Work From Home") {
        const dateObj = new Date(date + "T09:00:00");
        attendance.punches = [
          { type: "IN", time: dateObj },
          { type: "OUT", time: new Date(dateObj.getTime() + 9 * 60 * 60 * 1000) },
        ];
        attendance.totalHours = 9;
        attendance.status = "WFH";
      } else if (type === "On Duty") {
        const dateObj = new Date(date + "T09:00:00");
        attendance.punches = [
          { type: "IN", time: dateObj },
          { type: "OUT", time: new Date(dateObj.getTime() + 9 * 60 * 60 * 1000) },
        ];
        attendance.totalHours = 9;
        attendance.status = "OnDuty";
      }

      updateData.newAttendance = {
        punches: attendance.punches,
        totalHours: attendance.totalHours,
        status: attendance.status,
      };

      await attendance.save();

      // Log audit
      await AuditLog.create({
        action: "attendance_regularisation",
        userId: (user as any)._id,
        targetUserId: (regularisation as any).userId._id,
        entityType: "Attendance",
        entityId: attendance._id,
        oldValue: (regularisation as any).originalAttendance,
        newValue: updateData.newAttendance,
        remarks: remarks || `Regularisation approved: ${type}`,
      });
    }

    await Regularisation.findByIdAndUpdate(regularisationId, updateData);

    // Log audit
    await AuditLog.create({
      action: `regularisation_${action}`,
      userId: (user as any)._id,
      targetUserId: (regularisation as any).userId._id,
      entityType: "Regularisation",
      entityId: regularisationId,
      oldValue: { status: "Pending" },
      newValue: { status: updateData.status },
      remarks: remarks || "",
    });

    return NextResponse.json({
      success: true,
      message: `Regularisation request ${action === "approve" ? "approved" : "rejected"} successfully`,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

