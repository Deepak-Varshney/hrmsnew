// app/api/team/regularisation/pending/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Regularisation from "@/model/Regularisation";
import Employee from "@/model/Employee";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    // Get team member IDs
    const employees = await Employee.find({ managerId: (user as any)._id }).lean();
    const teamMemberIds = employees.map((emp: any) => emp.userId);

    // Get pending regularisation requests for team
    const regularisations = await Regularisation.find({
      userId: { $in: teamMemberIds },
      status: "Pending",
    })
      .populate("userId", "name email")
      .sort({ appliedAt: -1 })
      .lean();

    return NextResponse.json({ regularisations });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

