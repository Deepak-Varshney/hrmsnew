// app/api/attendance/today/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Attendance from "@/model/Attendance";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const today = new Date().toISOString().split("T")[0];
    const attendance = await Attendance.findOne({ 
      userId: (user as any)._id, 
      date: today 
    });

    return NextResponse.json({ attendance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

