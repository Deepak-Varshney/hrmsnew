// app/api/leave/route.ts

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { applyForLeave, cancelLeave } from "@/lib/services/leaveService";

export const POST = withContext(async (req) => {
  const body = await req.json();
  const { leave, days } = await applyForLeave(body);

  return NextResponse.json(
    {
      leave: { _id: leave._id, status: leave.status },
      message: `Applied for ${days} day${days === 1 ? "" : "s"}. Waiting for approval.`,
    },
    { status: 201 }
  );
});

export const DELETE = withContext(async (req) => {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });

  await cancelLeave(id);
  return NextResponse.json({ message: "Request withdrawn." });
});
