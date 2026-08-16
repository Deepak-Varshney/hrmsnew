// lib/rbac/serialize.ts
//
// The ONLY place employee records are shaped for output.
//
// Every route handler and server component that returns employee data calls
// serializeEmployee(). Do not hand-roll a projection per endpoint — one
// forgotten route is a mass PII leak, and that is exactly the failure this
// module exists to make impossible.

import { getContext } from "@/lib/context";
import { can } from "./guard";

export function maskTail(value?: string | null, visible = 4): string | null {
  if (!value) return null;
  const raw = String(value).replace(/\s+/g, "");
  if (raw.length <= visible) return "*".repeat(raw.length);
  return "*".repeat(raw.length - visible) + raw.slice(-visible);
}

export interface SerializeEmployeeOptions {
  /**
   * Return unmasked statutory and bank values. The caller MUST have already
   * written an `employee.pii.revealed` activity entry — see the reveal route.
   */
  reveal?: boolean;
}

/** May the current caller see PII on this particular employee? */
export function canSeePii(employeeId: string): boolean {
  const ctx = getContext();
  if (!ctx) return false;

  const scope = can("employee.pii.read");
  switch (scope) {
    case "platform":
    case "org":
      return true;
    case "self":
      return ctx.employeeId === employeeId;
    // MANAGER holds no employee.pii.read at any scope: a lead never sees
    // Aadhaar, PAN, or bank details, not even for their own reports.
    default:
      return false;
  }
}

/**
 * Shape an employee document for the current viewer.
 *
 * - No PII access  → `statutory` and `bank` are removed entirely.
 * - PII access     → values are masked unless `reveal` is set.
 */
export function serializeEmployee(
  employee: any,
  opts: SerializeEmployeeOptions = {}
): Record<string, any> {
  if (!employee) return employee;

  const plain =
    typeof employee.toObject === "function"
      ? employee.toObject({ virtuals: true })
      : { ...employee };

  const employeeId = String(plain._id ?? "");
  const allowed = canSeePii(employeeId);

  if (!allowed) {
    delete plain.statutory;
    delete plain.bank;
  } else if (!opts.reveal) {
    if (plain.statutory) {
      plain.statutory = {
        ...plain.statutory,
        aadhaar: maskTail(plain.statutory.aadhaar),
        pan: maskTail(plain.statutory.pan),
        uan: maskTail(plain.statutory.uan),
      };
    }
    if (plain.bank) {
      plain.bank = {
        ...plain.bank,
        accountNumber: maskTail(plain.bank.accountNumber),
      };
    }
  }

  // Internal bookkeeping never goes over the wire.
  delete plain.__v;
  delete plain.deletedBy;
  delete plain.deletedByRole;

  return plain;
}

export function serializeEmployees(
  employees: any[],
  opts: SerializeEmployeeOptions = {}
): Record<string, any>[] {
  return (employees ?? []).map((e) => serializeEmployee(e, opts));
}

/**
 * Minimal shape for the company directory: visible to every employee, and
 * carrying nothing sensitive regardless of the viewer's role.
 */
export function serializeDirectoryEntry(employee: any): Record<string, any> {
  if (!employee) return employee;
  const plain =
    typeof employee.toObject === "function" ? employee.toObject() : employee;

  return {
    _id: plain._id,
    employeeCode: plain.employeeCode,
    displayName: plain.displayName,
    photo: plain.photo ?? null,
    designationId: plain.designationId ?? null,
    departmentId: plain.departmentId ?? null,
    locationId: plain.locationId ?? null,
    workEmail: plain.contact?.workEmail ?? null,
    workPhone: plain.contact?.workPhone ?? null,
    status: plain.employment?.status ?? null,
  };
}
