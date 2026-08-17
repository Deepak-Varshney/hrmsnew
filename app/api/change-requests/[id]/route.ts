// app/api/change-requests/[id]/route.ts

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import {
  cancelChangeRequest,
  reviewChangeRequest,
} from "@/lib/services/changeRequests";

export const PATCH = withContext<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { decision, note } = await req.json();

  if (decision !== "approved" && decision !== "rejected") {
    return NextResponse.json(
      { error: "decision must be approved or rejected" },
      { status: 400 }
    );
  }

  const request = await reviewChangeRequest(id, decision, note);
  return NextResponse.json({
    status: request.status,
    message: decision === "approved" ? "Applied to the record." : "Request rejected.",
  });
});

/** Withdraw a pending request. */
export const DELETE = withContext<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await cancelChangeRequest(id);
  return NextResponse.json({ message: "Request withdrawn." });
});
