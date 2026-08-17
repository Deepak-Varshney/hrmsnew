// lib/services/changeRequests.ts
//
// Self-service edits go through HR.
//
// An employee never writes to their own Employee document. They submit a
// request; approving it is what performs the write, as an HR action. That
// gives you provenance on every field: who asked, who allowed it, and when.

import mongoose from "mongoose";
import ChangeRequest, { type IChangeField } from "@/model/ChangeRequest";
import Employee from "@/model/Employee";
import { getContext, requireOrgId } from "@/lib/context";
import { assertCan, can, ForbiddenError } from "@/lib/rbac";
import { maskTail } from "@/lib/rbac/serialize";
import { logActivity } from "@/lib/activity";
import { ValidationError, ConflictError } from "@/lib/services/employee";

/**
 * Fields an employee may *request* a change to, with the label HR sees.
 * Anything not listed here cannot be changed by the employee at all.
 */
export const REQUESTABLE_FIELDS: Record<string, { label: string; sensitive?: boolean }> = {
  "contact.personalEmail": { label: "Personal email" },
  "contact.personalPhone": { label: "Phone" },
  "contact.currentAddress": { label: "Current address" },
  "contact.permanentAddress": { label: "Permanent address" },
  dateOfBirth: { label: "Date of birth" },
  maritalStatus: { label: "Marital status" },
  bloodGroup: { label: "Blood group" },
  emergencyContacts: { label: "Emergency contacts" },
  family: { label: "Family details" },
  skills: { label: "Skills" },
  "bank.accountHolderName": { label: "Account holder name" },
  "bank.accountNumber": { label: "Bank account number", sensitive: true },
  "bank.ifsc": { label: "IFSC" },
  "bank.bankName": { label: "Bank name" },
  "bank.branch": { label: "Branch" },
};

function valueAt(obj: any, path: string) {
  return path.split(".").reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

function setAt(obj: any, path: string, value: any) {
  const parts = path.split(".");
  const last = parts.pop()!;
  const target = parts.reduce((acc, key) => {
    if (acc[key] == null || typeof acc[key] !== "object") acc[key] = {};
    return acc[key];
  }, obj);
  target[last] = value;
}

function sameValue(a: any, b: any) {
  if (a instanceof Date) a = a.toISOString();
  if (b instanceof Date) b = b.toISOString();
  if (typeof a === "object" || typeof b === "object") {
    return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
  }
  return String(a ?? "") === String(b ?? "");
}

/** Submit a change request for the signed-in employee's own record. */
export async function submitChangeRequest(
  updates: Record<string, any>,
  note?: string
) {
  const ctx = getContext();
  if (!ctx?.employeeId) throw new ValidationError("You have no employee record.");

  const orgId = requireOrgId();
  const employee: any = await Employee.findById(ctx.employeeId).lean();
  if (!employee) throw new ValidationError("Employee not found.");

  // One open request at a time. Two pending requests touching the same field
  // means whichever HR approves second silently overwrites the first.
  const open = await ChangeRequest.findOne({
    employeeId: ctx.employeeId,
    status: "pending",
  });
  if (open) {
    throw new ConflictError(
      "You already have a change request awaiting HR. Cancel it before submitting another."
    );
  }

  const fields: IChangeField[] = [];
  const rejected: string[] = [];

  for (const [path, newValue] of Object.entries(updates)) {
    const meta = REQUESTABLE_FIELDS[path];
    if (!meta) {
      rejected.push(path);
      continue;
    }

    const oldValue = valueAt(employee, path);

    // Ignore no-op edits so HR is not asked to approve an unchanged form.
    if (sameValue(oldValue, newValue)) continue;
    if (newValue === "" || newValue == null) continue;

    fields.push({
      path,
      label: meta.label,
      oldValue: meta.sensitive ? maskTail(oldValue) : oldValue,
      newValue,
      sensitive: Boolean(meta.sensitive),
    });
  }

  if (fields.length === 0) {
    throw new ValidationError(
      rejected.length > 0
        ? `Those fields cannot be changed here: ${rejected.join(", ")}`
        : "Nothing has changed."
    );
  }

  const request = await ChangeRequest.create({
    orgId,
    employeeId: ctx.employeeId,
    requestedBy: ctx.userId,
    requestedByName: ctx.userName,
    fields,
    note,
    status: "pending",
  });

  await logActivity({
    action: "changerequest.submitted",
    entityType: "ChangeRequest",
    entityId: request._id,
    entityLabel: `${ctx.userName} · ${fields.length} field(s)`,
    metadata: { paths: fields.map((f) => f.path) },
  });

  return request;
}

export async function listChangeRequests(status?: string) {
  const scope = await assertCan("changerequest.read");
  const ctx = getContext()!;

  const filter: Record<string, any> = {};
  if (status) filter.status = status;
  // An employee sees only their own; HR sees the org queue.
  if (scope === "self") filter.employeeId = ctx.employeeId;

  return ChangeRequest.find(filter)
    .populate("employeeId", "displayName employeeCode")
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
}

/** Approving is what actually writes to the Employee record. */
export async function reviewChangeRequest(
  requestId: string,
  decision: "approved" | "rejected",
  reviewNote?: string
) {
  await assertCan("changerequest.approve");
  const ctx = getContext()!;

  // Without this a malformed id reaches Mongoose as a CastError and surfaces
  // as a 500, which reads like the server broke rather than a bad request.
  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ValidationError("That is not a valid request id.");
  }

  const request = await ChangeRequest.findById(requestId);
  if (!request) throw new ValidationError("Request not found.");
  if (request.status !== "pending") {
    throw new ConflictError(`This request was already ${request.status}.`);
  }

  if (decision === "rejected" && !reviewNote?.trim()) {
    throw new ValidationError(
      "Say why it was rejected so the employee knows what to correct."
    );
  }

  if (decision === "approved") {
    const employee = await Employee.findById(request.employeeId);
    if (!employee) throw new ValidationError("Employee no longer exists.");

    const patch: Record<string, any> = {};
    for (const field of request.fields) {
      setAt(patch, field.path, field.newValue);
    }

    // Applied field by field so Mongoose casts nested paths correctly.
    for (const field of request.fields) {
      employee.set(field.path, field.newValue);
    }
    await employee.save();

    const changedBank = request.fields.some((f) => f.path.startsWith("bank."));
    if (changedBank) {
      await logActivity({
        action: "employee.bank.changed",
        entityType: "Employee",
        entityId: employee._id,
        entityLabel: `${employee.displayName} (${employee.employeeCode})`,
        metadata: { viaChangeRequest: String(request._id), approvedBy: ctx.userName },
        severity: "critical",
      });
    }
  }

  request.status = decision;
  request.reviewedBy = new mongoose.Types.ObjectId(ctx.userId) as any;
  request.reviewedByName = ctx.userName;
  request.reviewedAt = new Date();
  request.reviewNote = reviewNote?.trim() ?? null;
  await request.save();

  await logActivity({
    action: `changerequest.${decision}`,
    entityType: "ChangeRequest",
    entityId: request._id,
    entityLabel: `${request.requestedByName} · ${request.fields.length} field(s)`,
    metadata: { paths: request.fields.map((f) => f.path), reviewNote },
    severity: "warning",
  });

  return request;
}

/** An employee may withdraw their own pending request. */
export async function cancelChangeRequest(requestId: string) {
  const ctx = getContext()!;

  if (!mongoose.Types.ObjectId.isValid(requestId)) {
    throw new ValidationError("That is not a valid request id.");
  }

  const request = await ChangeRequest.findById(requestId);
  if (!request) throw new ValidationError("Request not found.");

  const isOwner = String(request.employeeId) === String(ctx.employeeId);
  if (!isOwner && can("changerequest.approve") === "none") {
    throw new ForbiddenError("changerequest.approve", "Not found");
  }
  if (request.status !== "pending") {
    throw new ConflictError(`This request was already ${request.status}.`);
  }

  request.status = "cancelled";
  await request.save();
  return request;
}
