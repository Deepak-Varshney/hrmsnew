// app/api/attendance/punch/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Attendance from "@/model/Attendance";

export async function POST(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD
    const now = new Date();
    
    // Get user agent and IP
    const ua = req.headers.get("user-agent") || "web";
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || undefined;

    // Find or create today's attendance
    let attendance = await Attendance.findOne({ userId: (user as any)._id, date: today });
    
    if (!attendance) {
      attendance = await Attendance.create({
        userId: (user as any)._id,
        date: today,
        punches: [],
      });
    }

    // Determine punch type based on last punch
    const lastPunch = attendance.punches.length > 0 
      ? attendance.punches[attendance.punches.length - 1] 
      : null;
    
    const punchType = lastPunch?.type === "IN" ? "OUT" : "IN";

    // Add new punch
    attendance.punches.push({
      type: punchType,
      time: now,
      device: ua,
      ip: ip,
    });

    // Calculate total hours
    if (attendance.punches.length >= 2) {
      let totalMs = 0;
      for (let i = 0; i < attendance.punches.length - 1; i += 2) {
        if (attendance.punches[i].type === "IN" && attendance.punches[i + 1]?.type === "OUT") {
          const inTime = new Date(attendance.punches[i].time).getTime();
          const outTime = new Date(attendance.punches[i + 1].time).getTime();
          totalMs += outTime - inTime;
        }
      }
      attendance.totalHours = totalMs / (1000 * 60 * 60); // Convert to hours
    }

    attendance.status = attendance.punches.length > 0 ? "Present" : "Absent";
    await attendance.save();

    return NextResponse.json({ attendance });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

