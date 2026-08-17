// lib/services/employee.ts
//
// Employee rules that must hold regardless of which route is calling:
// code generation, reporting-cycle prevention, and delete guards.

import mongoose from "mongoose";
import Employee from "@/model/Employee";
import Organization from "@/model/Organization";
import EmploymentHistory, { type ChangeType } from "@/model/EmploymentHistory";
import { getContext, requireOrgId } from "@/lib/context";

export class ValidationError extends Error {
  readonly status = 400;
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class ConflictError extends Error {
  readonly status = 409;
  constructor(message: string) {
    super(message);
    this.name = "ConflictError";
  }
}

/**
 * Next employee code for the org, e.g. EMP0042.
 *
 * The counter is incremented with a single atomic $inc, so two concurrent
 * creates cannot be handed the same code.
 *
 * It then skips forward over any code already in use. The counter alone is not
 * enough: a seed, an import or a migration can write codes directly without
 * touching it, and then the first employee added through the UI collides on
 * the unique index and fails with a 500. Rather than trust the counter, this
 * confirms the code is actually free.
 */
export async function generateEmployeeCode(orgId?: string): Promise<string> {
  const targetOrg = orgId ?? requireOrgId();

  // Bounded so a pathological gap cannot spin forever; 1000 attempts is far
  // beyond any real backlog and still returns in well under a second.
  for (let attempt = 0; attempt < 1000; attempt++) {
    const org = await Organization.findByIdAndUpdate(
      targetOrg,
      { $inc: { employeeCodeSeq: 1 } },
      { new: true, projection: { employeeCodePrefix: 1, employeeCodeSeq: 1 } },
    ).lean();

    if (!org) throw new ValidationError("Organization not found.");

    const prefix = (org as any).employeeCodePrefix ?? "EMP";
    const seq = (org as any).employeeCodeSeq ?? 1;
    const code = `${prefix}${String(seq).padStart(4, "0")}`;

    // withDeleted: a deleted employee still occupies the code, because the
    // unique index covers live rows and a restore would then collide.
    const taken = await Employee.findOne({ employeeCode: code })
      .withDeleted()
      .select("_id")
      .lean();

    if (!taken) return code;
  }

  throw new ConflictError(
    "Could not allocate an employee code. Check the employee code prefix in settings.",
  );
}

/**
 * Reject a reporting change that would create a cycle.
 *
 * Walks up from the proposed manager: if we reach the employee being edited,
 * the edge would close a loop and $graphLookup would recurse forever.
 */
export async function assertNoReportingCycle(
  employeeId: string,
  proposedManagerId: string | null | undefined,
): Promise<void> {
  if (!proposedManagerId) return;

  if (String(proposedManagerId) === String(employeeId)) {
    throw new ValidationError("An employee cannot report to themselves.");
  }

  const seen = new Set<string>([String(employeeId)]);
  let cursor: string | null = String(proposedManagerId);
  let hops = 0;

  while (cursor && hops < 100) {
    if (seen.has(cursor)) {
      throw new ValidationError(
        "That reporting line would create a cycle in the org chart.",
      );
    }
    seen.add(cursor);

    const manager: any = await Employee.findById(cursor)
      .select("reportsTo")
      .lean();
    if (!manager) break;

    cursor = manager.reportsTo ? String(manager.reportsTo) : null;
    hops++;
  }
}

/**
 * Guard before soft-deleting an employee.
 *
 * Deletes are blocked rather than cascaded — silently orphaning five people
 * because someone removed their manager is worse than an error message.
 */
export async function assertEmployeeDeletable(
  employeeId: string,
): Promise<void> {
  const ctx = getContext();

  if (ctx?.employeeId && String(ctx.employeeId) === String(employeeId)) {
    throw new ConflictError("You cannot delete your own employee record.");
  }

  const reportees = await Employee.countDocuments({ reportsTo: employeeId });
  if (reportees > 0) {
    throw new ConflictError(
      `This employee has ${reportees} direct reportee(s). Reassign them before deleting.`,
    );
  }

  const db = mongoose.connection.db;
  if (db) {
    const assets = await db
      .collection("assets")
      .countDocuments({
        assignedTo: new mongoose.Types.ObjectId(employeeId),
        returnedOn: null,
      })
      .catch(() => 0);
    if (assets > 0) {
      throw new ConflictError(
        `This employee still holds ${assets} assigned asset(s). Mark them returned first.`,
      );
    }
  }
}

/** Fields whose changes are worth a permanent EmploymentHistory row. */
const TRACKED: Array<{ path: string; changeType: ChangeType }> = [
  { path: "designationId", changeType: "designation-change" },
  { path: "departmentId", changeType: "department-change" },
  { path: "locationId", changeType: "location-change" },
  { path: "gradeId", changeType: "grade-change" },
  { path: "reportsTo", changeType: "manager-change" },
  { path: "employment.employmentType", changeType: "employment-type-change" },
  { path: "employment.status", changeType: "status-change" },
];

function valueAt(obj: any, path: string) {
  return path
    .split(".")
    .reduce((acc, key) => (acc == null ? acc : acc[key]), obj);
}

/**
 * Append EmploymentHistory rows for any tracked field that changed.
 *
 * Call this with the document state captured BEFORE the update and the
 * document after saving. Without it, an employee's role history is lost the
 * moment a field is overwritten.
 */
export async function recordEmploymentChanges(
  before: any,
  after: any,
  reason?: string,
): Promise<void> {
  const ctx = getContext();
  const orgId = after.orgId ?? requireOrgId();

  const rows = TRACKED.flatMap(({ path, changeType }) => {
    const oldValue = valueAt(before, path);
    const newValue = valueAt(after, path);
    if (String(oldValue ?? "") === String(newValue ?? "")) return [];

    return [
      {
        orgId,
        employeeId: after._id,
        changeType,
        field: path,
        oldValue: oldValue ?? null,
        newValue: newValue ?? null,
        effectiveFrom: new Date(),
        reason: reason ?? null,
        changedBy:
          ctx?.userId && ctx.userId !== "system"
            ? new mongoose.Types.ObjectId(ctx.userId)
            : null,
        changedByName: ctx?.userName ?? null,
      },
    ];
  });

  if (rows.length > 0) {
    await EmploymentHistory.insertMany(rows);
  }
}

/**
 * Resolve an employee by Employee._id, falling back to User._id.
 *
 * @deprecated the userId fallback — the legacy UI passes User ids. Remove it
 * once the frontend sends Employee ids everywhere.
 */
export async function findEmployeeByEitherId(id: string) {
  if (!mongoose.Types.ObjectId.isValid(id)) return null;

  const byId = await Employee.findById(id);
  if (byId) return byId;

  return Employee.findOne({ userId: id });
}
