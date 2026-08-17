// app/api/documents/route.ts

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { getContext } from "@/lib/context";
import {
  listDocuments,
  uploadEmployeeDocument,
} from "@/lib/services/documentService";
import { isCloudinaryConfigured } from "@/lib/cloudinary";

export const GET = withContext(async (req) => {
  const ctx = getContext()!;
  const requested = new URL(req.url).searchParams.get("employeeId");
  const employeeId = requested ?? ctx.employeeId;

  if (!employeeId) {
    return NextResponse.json({ error: "No employee record" }, { status: 400 });
  }

  return NextResponse.json(await listDocuments(employeeId));
});

export const POST = withContext(async (req) => {
  if (!isCloudinaryConfigured()) {
    return NextResponse.json(
      {
        error:
          "File storage is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET.",
      },
      { status: 503 }
    );
  }

  const ctx = getContext()!;
  const form = await req.formData();

  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Attach a file to upload" }, { status: 400 });
  }

  const employeeId = (form.get("employeeId") as string) || ctx.employeeId;
  if (!employeeId) {
    return NextResponse.json({ error: "No employee record" }, { status: 400 });
  }

  const doc = await uploadEmployeeDocument({
    employeeId,
    file,
    category: (form.get("category") as string) || "Other",
    name: (form.get("name") as string) || undefined,
    source: (form.get("source") as string) === "company" ? "company" : "personal",
    issueDate: (form.get("issueDate") as string) || undefined,
    expiryDate: (form.get("expiryDate") as string) || undefined,
  });

  return NextResponse.json(
    {
      document: {
        _id: doc._id,
        name: doc.name,
        category: doc.category,
        source: doc.source,
        verificationStatus: doc.verificationStatus,
        sizeBytes: doc.sizeBytes,
        createdAt: (doc as any).createdAt,
      },
    },
    { status: 201 }
  );
});
