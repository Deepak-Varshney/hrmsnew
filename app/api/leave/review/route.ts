// app/api/leave/review/route.ts

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { reviewLeave } from "@/lib/services/leaveService";

export const POST = withContext(async (req) => {
  const { leaveId, decision, remarks } = await req.json();

  if (decision !== "Approved" && decision !== "Rejected") {
    return NextResponse.json(
      { error: "decision must be Approved or Rejected" },
      { status: 400 }
    );
  }

  const leave = await reviewLeave(leaveId, decision, remarks);
  return NextResponse.json({
    status: leave.status,
    message: decision === "Approved" ? "Leave approved." : "Leave rejected.",
  });
});
