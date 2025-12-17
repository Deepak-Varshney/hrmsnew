// app/api/attendance/history/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Attendance from "@/model/Attendance";
import { attachReactRefresh } from "next/dist/build/webpack-config";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const month = searchParams.get("month"); // YYYY-MM format

    const query: any = { userId: (user as any)._id };

    if (month) {
      const [year, monthNum] = month.split("-");
      const start = `${year}-${monthNum}-01`;
      const endDate = new Date(parseInt(year), parseInt(monthNum), 0).getDate();
      const end = `${year}-${monthNum}-${endDate.toString().padStart(2, "0")}`;
      query.date = { $gte: start, $lte: end };
    } else if (startDate && endDate) {
      query.date = { $gte: startDate, $lte: endDate };
    }

    const attendance = await Attendance.find(query)
      .sort({ date: -1 })
      .limit(100)
      .lean();
      return NextResponse.json({ attendance });
    } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

