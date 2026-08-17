// app/api/documents/[id]/url/route.ts
//
// Returns a short-lived signed URL rather than proxying the file.
//
// The URL expires in five minutes and every request here is recorded — these
// are identity documents, and "who looked at this, and when" is a question
// worth being able to answer.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { documentAccessUrl } from "@/lib/services/documentService";

export const GET = withContext<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  const result = await documentAccessUrl(id);

  return NextResponse.json(result, {
    // A signed, expiring URL must never sit in a shared cache.
    headers: { "Cache-Control": "no-store, private" },
  });
});
