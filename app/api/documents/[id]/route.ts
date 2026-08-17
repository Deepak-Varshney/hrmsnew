// app/api/documents/[id]/route.ts

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { deleteDocument, verifyDocument } from "@/lib/services/documentService";

export const PATCH = withContext<{ id: string }>(async (req, { params }) => {
  const { id } = await params;
  const { status, reason } = await req.json();

  if (status !== "verified" && status !== "rejected") {
    return NextResponse.json(
      { error: "status must be verified or rejected" },
      { status: 400 }
    );
  }

  const doc = await verifyDocument(id, status, reason);
  return NextResponse.json({
    document: { _id: doc._id, verificationStatus: doc.verificationStatus },
  });
});

export const DELETE = withContext<{ id: string }>(async (_req, { params }) => {
  const { id } = await params;
  await deleteDocument(id);
  return NextResponse.json({ ok: true, message: "Document removed." });
});
