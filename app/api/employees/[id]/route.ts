// app/api/employees/[id]/route.ts
//
// `id` is an Employee._id. For backwards compatibility with the legacy UI it
// also accepts a User._id — see findEmployeeByEitherId, which is marked
// deprecated and should be removed once the frontend is updated.

import { NextResponse } from "next/server";

import { withContext } from "@/lib/withContext";
import {
  can,
  isWithinScope,
  serializeEmployee,
  ForbiddenError,
} from "@/lib/rbac";
import {
  SELF_EDITABLE_EMPLOYEE_FIELDS,
  APPROVAL_REQUIRED_EMPLOYEE_FIELDS,
} from "@/lib/rbac/permissions";
import { getContext } from "@/lib/context";
import Employee from "@/model/Employee";
import EmploymentHistory from "@/model/EmploymentHistory";
import {
  assertEmployeeDeletable,
  assertNoReportingCycle,
  findEmployeeByEitherId,
  recordEmploymentChanges,
  ValidationError,
} from "@/lib/services/employee";

/** Fields an ADMIN may set. MANAGER and EMPLOYEE are narrowed further below. */
const ADMIN_WRITABLE = new Set([
  "firstName",
  "middleName",
  "lastName",
  "dateOfBirth",
  "gender",
  "bloodGroup",
  "maritalStatus",
  "photo",
  "contact",
  "emergencyContacts",
  "statutory",
  "bank",
  "employment",
  "departmentId",
  "designationId",
  "locationId",
  "gradeId",
  "costCenter",
  "reportsTo",
  "dottedLineManagerId",
  "exit",
  "education",
  "previousEmployment",
  "family",
  "skills",
  "certifications",
  "customFields",
]);

/** A manager may correct their reportees' basics, not their pay or identity. */
const MANAGER_WRITABLE = new Set([
  "contact",
  "emergencyContacts",
  "skills",
  "certifications",
  "photo",
]);

function writableFieldsFor(role: string | null, isSuperAdmin: boolean): Set<string> {
  if (isSuperAdmin || role === "ADMIN") return ADMIN_WRITABLE;
  if (role === "MANAGER") return MANAGER_WRITABLE;
  return SELF_EDITABLE_EMPLOYEE_FIELDS;
}

export const GET = withContext<{ id: string }>(
  async (_req, { params }) => {
    const { id } = await params;

    const employee = await findEmployeeByEitherId(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const scope = can("employee.read");
    if (!(await isWithinScope(scope, String(employee._id)))) {
      // 404 rather than 403 — don't confirm that an out-of-scope employee exists.
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    await employee.populate([
      { path: "departmentId", select: "name code" },
      { path: "designationId", select: "title code" },
      { path: "locationId", select: "name code" },
      { path: "gradeId", select: "name level" },
      { path: "reportsTo", select: "displayName employeeCode" },
    ]);

    const history = await EmploymentHistory.find({ employeeId: employee._id })
      .sort({ effectiveFrom: -1 })
      .limit(50)
      .lean();

    return NextResponse.json({
      employee: serializeEmployee(employee),
      history,
    });
  },
  { permission: "employee.read" }
);

export const PUT = withContext<{ id: string }>(
  async (req, { params }) => {
    const { id } = await params;
    const ctx = getContext()!;

    const employee = await findEmployeeByEitherId(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const scope = can("employee.update");
    if (!(await isWithinScope(scope, String(employee._id)))) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const body = (await req.json()) ?? {};
    const writable = writableFieldsFor(ctx.role, ctx.isSuperAdmin);

    const rejected: string[] = [];
    const needsApproval: string[] = [];

    // Snapshot before mutating, so EmploymentHistory can diff against it.
    const before = employee.toObject();

    for (const [key, value] of Object.entries(body)) {
      if (!writable.has(key)) {
        // An employee editing their own restricted fields gets told to raise a
        // change request rather than a flat rejection.
        if (
          scope === "self" &&
          APPROVAL_REQUIRED_EMPLOYEE_FIELDS.has(key)
        ) {
          needsApproval.push(key);
        } else {
          rejected.push(key);
        }
        continue;
      }

      if (key === "reportsTo") {
        await assertNoReportingCycle(String(employee._id), value as string | null);
      }

      (employee as any).set(key, value);
    }

    if (needsApproval.length > 0) {
      throw new ForbiddenError(
        "employee.update",
        `These fields require HR approval: ${needsApproval.join(", ")}. Submit a change request.`
      );
    }

    await employee.save();
    await recordEmploymentChanges(before, employee.toObject(), body.__reason);

    return NextResponse.json({
      success: true,
      employee: serializeEmployee(employee),
      ...(rejected.length > 0 ? { ignoredFields: rejected } : {}),
    });
  },
  { permission: "employee.update" }
);

export const DELETE = withContext<{ id: string }>(
  async (req, { params }) => {
    const { id } = await params;

    const employee = await findEmployeeByEitherId(id);
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const scope = can("employee.delete");
    if (!(await isWithinScope(scope, String(employee._id)))) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Blocks rather than cascades: reportees and held assets must be dealt
    // with deliberately.
    await assertEmployeeDeletable(String(employee._id));

    const url = new URL(req.url);
    const reason = url.searchParams.get("reason") ?? undefined;

    // Soft delete. Recoverable from the recycle bin by Super Admin (or by an
    // admin, if the org has opted in).
    await (employee as any).softDelete(reason);

    return NextResponse.json({
      success: true,
      message: "Employee deleted. Recoverable from the recycle bin.",
    });
  },
  { permission: "employee.delete" }
);
