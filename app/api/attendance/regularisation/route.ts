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
    const employee = await Employee.findOne({ userId: (user as any)._id })
      .populate("managerId", "name email")
      .lean();
    
    // Handle populated managerId - when populated, it's an object with _id, name, email
    // When not populated or doesn't exist, it's null/undefined or ObjectId
    const manager = employee?.managerId as any;
    const managerId = manager && typeof manager === 'object' && '_id' in manager 
      ? manager._id 
      : (manager || null);
    const managerName = manager && typeof manager === 'object' && 'name' in manager
      ? manager.name 
      : "Manager";

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
      approverId: managerId || undefined,
      originalAttendance: existingAttendance
        ? {
            punches: existingAttendance.punches,
            totalHours: existingAttendance.totalHours,
            status: existingAttendance.status,
          }
        : undefined,
      appliedAt: new Date(),
    });

    return NextResponse.json({ 
      regularisation,
      managerName 
    });
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
      .populate("userId", "name email")
      .lean();

    return NextResponse.json({ regularisations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

