// app/api/leave/balance/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import LeaveBalance from "@/model/LeaveBalance";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const year = searchParams.get("year") || new Date().getFullYear().toString();

    const balances = await LeaveBalance.find({
      userId: (user as any)._id,
      year: parseInt(year),
    }).lean();

    // If no balances exist, return default structure with 0 balances
    const leaveTypes = ["CL", "SL", "EL", "LOP"]; // Casual Leave, Sick Leave, Earned Leave, Loss of Pay
    const balanceMap: any = {};

    leaveTypes.forEach((type) => {
      const balance = balances.find((b) => b.leaveType === type);
      balanceMap[type] = balance
        ? {
            totalCredited: balance.totalCredited,
            used: balance.used,
            balance: balance.balance,
          }
        : {
            totalCredited: 0,
            used: 0,
            balance: 0,
          };
    });

    return NextResponse.json({ balances: balanceMap, year: parseInt(year) });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

