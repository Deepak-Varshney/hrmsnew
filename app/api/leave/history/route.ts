// app/api/leave/history/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Leave from "@/model/Leave";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const leaveType = searchParams.get("leaveType");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");

    const query: any = { userId: (user as any)._id };

    if (status) {
      query.status = status;
    }
    if (leaveType) {
      query.leaveType = leaveType;
    }
    if (startDate && endDate) {
      query.$or = [
        { fromDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
        { toDate: { $gte: new Date(startDate), $lte: new Date(endDate) } },
      ];
    }

    const leaves = await Leave.find(query)
      .sort({ appliedAt: -1 })
      .populate("approverId", "name email")
      .lean();

    return NextResponse.json({ leaves });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

