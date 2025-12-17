// app/api/audit/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import AuditLog from "@/model/AuditLog";

export async function GET(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");
    const targetUserId = searchParams.get("targetUserId");
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const limit = parseInt(searchParams.get("limit") || "100");

    const query: any = {};

    if (action) query.action = action;
    if (userId) query.userId = userId;
    if (targetUserId) query.targetUserId = targetUserId;
    if (startDate && endDate) {
      query.createdAt = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const logs = await AuditLog.find(query)
      .populate("userId", "name email")
      .populate("targetUserId", "name email")
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    return NextResponse.json({ logs });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

