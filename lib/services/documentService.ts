// lib/services/documentService.ts
//
// Employee documents: who may upload what, who may see it, and how it is
// served.
//
// Two sources with different rules:
//   personal — the employee uploads these (Aadhaar, PAN, certificates)
//   company  — HR issues these (offer letter, appraisal, experience letter)
//
// An employee can add to `personal` and only read `company`. Nobody reads a
// document without the read being recorded — these are identity documents,
// and "who looked at this" is a question you want to be able to answer.

import DocumentModel from "@/model/Document";
import Employee from "@/model/Employee";
import { getContext } from "@/lib/context";
import { assertCan, can, isWithinScope, ForbiddenError } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import {
  deleteAsset,
  signedDocumentUrl,
  uploadDocument,
  MAX_UPLOAD_BYTES,
} from "@/lib/cloudinary";
import { ValidationError, ConflictError } from "@/lib/services/employee";

export const PERSONAL_CATEGORIES = [
  "Aadhaar",
  "PAN",
  "Passport",
  "Educational certificate",
  "Previous experience letter",
  "Bank proof",
  "Address proof",
  "Other",
];

export const COMPANY_CATEGORIES = [
  "Offer letter",
  "Appointment letter",
  "Confirmation letter",
  "Appraisal letter",
  "Experience letter",
  "Relieving letter",
  "Salary certificate",
  "Other",
];

/** Documents for an employee, if the caller's scope reaches them. */
export async function listDocuments(employeeId: string) {
  const scope = await assertCan("document.read");

  if (!(await isWithinScope(scope, employeeId))) {
    throw new ForbiddenError("document.read", "Not found");
  }

  const rows = await DocumentModel.find({ employeeId })
    .sort({ createdAt: -1 })
    .lean();

  return {
    personal: rows.filter((d: any) => d.source === "personal"),
    company: rows.filter((d: any) => d.source === "company"),
  };
}

export async function uploadEmployeeDocument(params: {
  employeeId: string;
  file: File;
  category: string;
  name?: string;
  source: "personal" | "company";
  issueDate?: string;
  expiryDate?: string;
}) {
  const scope = await assertCan("document.create");
  const ctx = getContext()!;

  if (!(await isWithinScope(scope, params.employeeId))) {
    throw new ForbiddenError("document.create", "Not found");
  }

  // Only HR issues company documents. An employee uploading their own
  // "offer letter" would be forging a company record.
  if (params.source === "company" && can("document.verify") === "none") {
    throw new ForbiddenError(
      "document.verify",
      "Only HR can add company-issued documents."
    );
  }

  if (params.file.size === 0) throw new ValidationError("That file is empty.");
  if (params.file.size > MAX_UPLOAD_BYTES) {
    throw new ValidationError(
      `Files must be under ${MAX_UPLOAD_BYTES / 1024 / 1024} MB.`
    );
  }

  const employee: any = await Employee.findById(params.employeeId)
    .select("orgId displayName employeeCode")
    .lean();
  if (!employee) throw new ValidationError("Employee not found.");

  const buffer = Buffer.from(await params.file.arrayBuffer());

  const uploaded = await uploadDocument(buffer, {
    orgId: String(employee.orgId),
    employeeId: params.employeeId,
    filename: params.file.name,
    mimeType: params.file.type,
  });

  const doc = await DocumentModel.create({
    orgId: employee.orgId,
    employeeId: params.employeeId,
    source: params.source,
    category: params.category,
    name: params.name?.trim() || params.file.name,
    storageKey: uploaded.publicId,
    mimeType: params.file.type,
    sizeBytes: uploaded.bytes,
    issueDate: params.issueDate ? new Date(params.issueDate) : null,
    expiryDate: params.expiryDate ? new Date(params.expiryDate) : null,
    // A company-issued document is verified by definition — HR produced it.
    verificationStatus: params.source === "company" ? "verified" : "pending",
    uploadedBy: ctx.userId,
  });

  return doc;
}

/**
 * A short-lived URL for viewing or downloading.
 *
 * Recorded every time. The URL expires in five minutes, so one pasted into a
 * chat is useless by the time anyone else opens it.
 */
export async function documentAccessUrl(documentId: string) {
  const scope = await assertCan("document.read");

  const doc: any = await DocumentModel.findById(documentId).lean();
  if (!doc) throw new ValidationError("Document not found.");

  if (!(await isWithinScope(scope, String(doc.employeeId)))) {
    throw new ForbiddenError("document.read", "Not found");
  }

  const resourceType = doc.mimeType === "application/pdf" ? "image" : "image";

  const url = signedDocumentUrl(doc.storageKey, {
    resourceType,
    expiresInSeconds: 300,
  });

  await logActivity({
    action: "document.accessed",
    entityType: "Document",
    entityId: doc._id,
    entityLabel: doc.name,
    metadata: { category: doc.category, source: doc.source },
    severity: "warning",
  });

  return { url, name: doc.name, mimeType: doc.mimeType };
}

export async function verifyDocument(
  documentId: string,
  status: "verified" | "rejected",
  reason?: string
) {
  await assertCan("document.verify");
  const ctx = getContext()!;

  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new ValidationError("Document not found.");

  if (status === "rejected" && !reason?.trim()) {
    // A rejection without a reason leaves the employee with nothing to act on.
    throw new ValidationError("Say why it was rejected so it can be corrected.");
  }

  doc.verificationStatus = status;
  doc.verifiedBy = ctx.userId as any;
  doc.verifiedAt = new Date();
  doc.rejectionReason = status === "rejected" ? reason!.trim() : null;
  await doc.save();

  return doc;
}

export async function deleteDocument(documentId: string) {
  const scope = await assertCan("document.delete");

  const doc = await DocumentModel.findById(documentId);
  if (!doc) throw new ValidationError("Document not found.");

  if (!(await isWithinScope(scope, String(doc.employeeId)))) {
    throw new ForbiddenError("document.delete", "Not found");
  }

  // A verified company document is part of the employment record. Removing
  // it should be deliberate, not a side effect of tidying up.
  if (doc.source === "company" && can("document.verify") === "none") {
    throw new ConflictError("Company-issued documents can only be removed by HR.");
  }

  // Soft-delete the record first so the audit trail survives, then remove the
  // asset. If the remote delete fails the row is already gone from the UI and
  // the orphan can be swept later — the reverse would leave a dangling row
  // pointing at nothing.
  await (doc as any).softDelete("Deleted by user");

  try {
    await deleteAsset(doc.storageKey, { type: "authenticated" });
  } catch (err) {
    console.error("[documents] asset delete failed, row already removed", {
      storageKey: doc.storageKey,
      err,
    });
  }

  return doc;
}
