// app/api/leave/balance/adjust/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import LeaveBalance from "@/model/LeaveBalance";
import AuditLog from "@/model/AuditLog";

export async function POST(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const { userId, leaveType, year, adjustment, reason } = await req.json();

    if (!userId || !leaveType || !year || adjustment === undefined || !reason) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    let balance = await LeaveBalance.findOne({ userId, leaveType, year });

    const oldValue = balance
      ? {
          totalCredited: balance.totalCredited,
          used: balance.used,
          balance: balance.balance,
        }
      : { totalCredited: 0, used: 0, balance: 0 };

    if (!balance) {
      balance = await LeaveBalance.create({
        userId,
        leaveType,
        year: parseInt(year),
        totalCredited: 0,
        used: 0,
        balance: 0,
      });
    }

    // Adjust balance (positive adds, negative subtracts)
    balance.totalCredited = (balance.totalCredited || 0) + parseFloat(adjustment);
    balance.balance = balance.totalCredited - (balance.used || 0);
    balance.lastUpdated = new Date();
    balance.lastUpdatedBy = (user as any)._id;
    await balance.save();

    // Log audit
    await AuditLog.create({
      action: "leave_balance_adjust",
      userId: (user as any)._id,
      targetUserId: userId,
      entityType: "LeaveBalance",
      entityId: balance._id,
      oldValue,
      newValue: {
        totalCredited: balance.totalCredited,
        used: balance.used,
        balance: balance.balance,
      },
      remarks: reason,
    });

    return NextResponse.json({
      success: true,
      balance: {
        totalCredited: balance.totalCredited,
        used: balance.used,
        balance: balance.balance,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

