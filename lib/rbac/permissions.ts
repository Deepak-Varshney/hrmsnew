// lib/rbac/permissions.ts
//
// The single source of truth for who can do what.
//
// A permission maps to a SCOPE, not a boolean. "employee.read" granted at
// "team" means the caller may read employees, but only within their reporting
// subtree. The scope is what turns into a Mongo filter — see lib/rbac/scope.ts.

import type { Role } from "@/lib/context";

/** Breadth of a granted permission. */
export type Scope = "platform" | "org" | "team" | "self" | "none";

export type Permission =
  // Employees
  | "employee.read"
  | "employee.create"
  | "employee.update"
  | "employee.delete"
  | "employee.export"
  | "employee.pii.read"
  // Self-service edits, which always route through HR
  | "changerequest.read"
  | "changerequest.approve"
  // Documents
  | "document.read"
  | "document.create"
  | "document.verify"
  | "document.delete"
  // Assets
  | "asset.read"
  | "asset.write"
  // Org master data (departments, designations, locations, grades)
  | "master.read"
  | "master.write"
  // Users & access
  | "user.read"
  | "user.invite"
  | "user.suspend"
  | "membership.assign"
  // Onboarding / offboarding
  | "checklist.template.write"
  | "checklist.assign"
  | "checklist.complete"
  // Attendance
  | "attendance.punch"
  | "attendance.read"
  | "attendance.approve"
  // Leave
  | "leave.request"
  | "leave.read"
  | "leave.approve"
  | "leave.configure"
  // Payroll
  | "payroll.read"
  | "payroll.run"
  | "payroll.approve"
  // Audit & recovery
  | "activity.read"
  | "recyclebin.read"
  | "record.restore"
  | "record.purge"
  // Organization & platform
  | "org.settings"
  | "org.manage"
  | "platform.impersonate";

type PermissionMap = Partial<Record<Permission, Scope>>;

/**
 * SUPER_ADMIN is intentionally not listed. It is handled as a short-circuit in
 * can(): every permission resolves to "platform". Enumerating it here would
 * mean a new permission silently defaults to denied for the one role that is
 * supposed to be able to do anything.
 */
const ROLE_PERMISSIONS: Record<Exclude<Role, "SUPER_ADMIN">, PermissionMap> = {
  ADMIN: {
    "employee.read": "org",
    "employee.create": "org",
    "employee.update": "org",
    "employee.delete": "org",
    "employee.export": "org",
    "employee.pii.read": "org",

    "document.read": "org",
    "document.create": "org",
    "document.verify": "org",
    "document.delete": "org",

    "asset.read": "org",
    "asset.write": "org",

    "master.read": "org",
    "master.write": "org",

    "user.read": "org",
    "user.invite": "org",
    "user.suspend": "org",
    "membership.assign": "org",

    "checklist.template.write": "org",
    "checklist.assign": "org",
    "checklist.complete": "org",

    "attendance.punch": "self",
    "attendance.read": "org",
    "attendance.approve": "org",

    "leave.request": "self",
    "leave.read": "org",
    "leave.approve": "org",
    "leave.configure": "org",

    "changerequest.read": "org",
    "changerequest.approve": "org",

    "payroll.read": "org",
    "payroll.run": "org",
    "payroll.approve": "org",

    "activity.read": "org",
    "recyclebin.read": "org",
    // Restore and purge are deliberately absent — Super Admin only.
    // An org may opt into admin restore; see canRestoreAsAdmin() below.

    "org.settings": "org",
  },

  MANAGER: {
    "employee.read": "team",
    "employee.update": "team",
    "employee.delete": "team",
    "employee.export": "team",
    // No employee.pii.read at any scope: a lead does not see Aadhaar,
    // PAN, or bank details for their reports.

    "document.read": "team",
    "document.create": "team",
    "document.verify": "team",
    "document.delete": "team",

    "asset.read": "team",

    // Read-only: needed to populate filters and dropdowns.
    "master.read": "org",

    "checklist.assign": "team",
    "checklist.complete": "team",

    "attendance.punch": "self",
    "attendance.read": "team",
    "attendance.approve": "team",

    "leave.request": "self",
    "leave.read": "team",
    "leave.approve": "team",

    // Read-only: leads and managers see their team's payslips but never
    // run or approve payroll. That stays with ADMIN.
    "payroll.read": "team",

    "activity.read": "team",
  },

  /**
   * A lead runs a team but does not own its records: they can see everyone
   * reporting to them and decide their leave, but cannot edit or remove an
   * employee. Personnel changes stay with MANAGER and ADMIN.
   */
  LEAD: {
    "employee.read": "team",
    "employee.export": "team",
    // No employee.update or employee.delete — read-only on people.
    // No employee.pii.read — Aadhaar, PAN and bank stay with HR.

    "document.read": "team",

    "asset.read": "team",

    // Read-only: needed to populate filters and dropdowns.
    "master.read": "org",

    "checklist.complete": "self",

    "attendance.punch": "self",
    "attendance.read": "team",
    "attendance.approve": "team",

    "leave.request": "self",
    "leave.read": "team",
    "leave.approve": "team",

    "payroll.read": "team",

    "activity.read": "team",
  },

  EMPLOYEE: {
    "employee.read": "self",
    "employee.update": "self",
    "employee.pii.read": "self",

    "document.read": "self",
    "document.create": "self",
    // Own uploads only — the service refuses company-issued documents for
    // anyone without document.verify, so this cannot remove an offer letter.
    "document.delete": "self",

    "asset.read": "self",

    "master.read": "org",

    "checklist.complete": "self",

    "attendance.punch": "self",
    "attendance.read": "self",

    "leave.request": "self",
    "leave.read": "self",

    "payroll.read": "self",

    // Employees can raise and track their own requests, never approve them.
    "changerequest.read": "self",

    "activity.read": "self",
  },
};

export function permissionsFor(role: Role): PermissionMap {
  if (role === "SUPER_ADMIN") return {};
  return ROLE_PERMISSIONS[role] ?? {};
}

/**
 * Employee fields an employee may change on their own record without HR
 * approval. Everything else routes through a change request.
 */
/**
 * Fields an employee may change on their own record with no review.
 *
 * Deliberately just the profile photo. Every other self-service edit goes
 * through a ChangeRequest and HR approval — see lib/services/changeRequests.
 * The requestable set lives there, as REQUESTABLE_FIELDS.
 */
export const SELF_EDITABLE_EMPLOYEE_FIELDS = new Set(["photo"]);

/**
 * Employee fields that require HR approval when the employee initiates the
 * change. Producing a ChangeRequest rather than a direct write.
 */
/**
 * Changing these is effectively changing who the record is about, or a value
 * the company must be able to defend to a regulator. HR approves them.
 */
export const APPROVAL_REQUIRED_EMPLOYEE_FIELDS = new Set([
  "firstName",
  "middleName",
  "lastName",
  "statutory",
]);

/** Blocks that are stripped unless the viewer holds `employee.pii.read`. */
export const PII_EMPLOYEE_PATHS = ["statutory", "bank"] as const;
