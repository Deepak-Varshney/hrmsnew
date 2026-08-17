// app/api/profile/route.ts
//
// Self-service edits.
//
// An employee does not write to their own record — this submits a change
// request for HR. Approving it is what performs the write, so every field
// carries provenance: who asked, who allowed it, and when.
//
// The photo is the one exception, handled by the avatar route.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { submitChangeRequest } from "@/lib/services/changeRequests";

export const PATCH = withContext(async (req) => {
  const body = (await req.json()) ?? {};
  const { note, ...updates } = body;

  const request = await submitChangeRequest(updates, note);

  return NextResponse.json(
    {
      request: {
        _id: request._id,
        status: request.status,
        fields: request.fields.map((f) => f.label),
      },
      message: `Sent to HR for approval — ${request.fields.length} change${
        request.fields.length === 1 ? "" : "s"
      }.`,
    },
    { status: 202 }
  );
});
