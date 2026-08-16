// app/api/attendance/punch/route.ts
//
// Toggles a punch: IN if the last one was OUT (or there is none), OUT if the
// clock is running. The client never says which — deciding on the server
// keeps the sequence consistent when someone has two tabs open.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { getContext, requireOrgId } from "@/lib/context";
import { logActivity } from "@/lib/activity";
import Attendance from "@/model/Attendance";

/** Sum of completed IN→OUT pairs, in hours. An open IN contributes nothing. */
function totalHoursOf(punches: { type: string; time: Date }[]): number {
  let ms = 0;
  for (let i = 0; i < punches.length - 1; i++) {
    if (punches[i].type === "IN" && punches[i + 1]?.type === "OUT") {
      ms += new Date(punches[i + 1].time).getTime() - new Date(punches[i].time).getTime();
      i++; // consume the pair
    }
  }
  return Number((ms / 3_600_000).toFixed(4));
}

export const POST = withContext(
  async (req) => {
    const ctx = getContext()!;
    const orgId = requireOrgId();

    const date = new Date().toISOString().split("T")[0];
    const now = new Date();

    let attendance = await Attendance.findOne({ userId: ctx.userId, date });
    if (!attendance) {
      attendance = await Attendance.create({
        orgId,
        userId: ctx.userId,
        date,
        punches: [],
        status: "Present",
      });
    }
    // Backfill orgId on records created before the field existed.
    if (!attendance.orgId) attendance.orgId = orgId as any;

    const last = attendance.punches[attendance.punches.length - 1];
    const type: "IN" | "OUT" = last?.type === "IN" ? "OUT" : "IN";

    attendance.punches.push({
      type,
      time: now,
      device: req.headers.get("user-agent") ?? "web",
      ip: ctx.ip,
    });

    attendance.totalHours = totalHoursOf(attendance.punches as any);
    attendance.status = "Present";
    await attendance.save();

    await logActivity({
      action: type === "IN" ? "attendance.checked_in" : "attendance.checked_out",
      entityType: "Attendance",
      entityId: attendance._id,
      entityLabel: `${ctx.userName} · ${date}`,
      metadata: { at: now.toISOString() },
    });

    return NextResponse.json({
      type,
      at: now.toISOString(),
      totalHours: attendance.totalHours,
      isCheckedIn: type === "IN",
    });
  },
  { permission: "attendance.punch" }
);
