// app/api/employees/managers/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import User from "@/model/User";

export async function GET(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    // Get all managers and admins (who can be assigned as managers)
    const managers = await User.find({
      role: { $in: ["Manager", "HR", "Admin"] },
      isActive: true,
    })
      .select("name email role")
      .lean();

    return NextResponse.json({ managers });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

