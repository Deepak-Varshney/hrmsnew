// app/api/attendance/regularisation/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Regularisation from "@/model/Regularisation";
import Attendance from "@/model/Attendance";
import Employee from "@/model/Employee";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { date, type, reason, attachment } = await req.json();
    if (!date || !type || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Get employee's manager
    const employee = await Employee.findOne({ userId: (user as any)._id });
    const managerId = employee?.managerId;

    // Get existing attendance for audit
    const existingAttendance = await Attendance.findOne({
      userId: (user as any)._id,
      date: date,
    });

    const regularisation = await Regularisation.create({
      userId: (user as any)._id,
      date,
      type,
      reason,
      attachment,
      status: "Pending",
      approverId: managerId,
      originalAttendance: existingAttendance
        ? {
            punches: existingAttendance.punches,
            totalHours: existingAttendance.totalHours,
            status: existingAttendance.status,
          }
        : null,
      appliedAt: new Date(),
    });

    return NextResponse.json({ regularisation });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const query: any = { userId: (user as any)._id };
    if (status) {
      query.status = status;
    }

    const regularisations = await Regularisation.find(query)
      .sort({ appliedAt: -1 })
      .populate("approverId", "name email")
      .lean();

    return NextResponse.json({ regularisations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

