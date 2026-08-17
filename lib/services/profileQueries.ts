// lib/services/profileQueries.ts
//
// Everything the profile page shows, loaded in one pass on the server.

import Employee from "@/model/Employee";
import Membership from "@/model/Membership";
import DocumentModel from "@/model/Document";
import HRNotice from "@/model/HRNotice";
import SalaryStructure from "@/model/SalaryStructure";
import EmploymentHistory from "@/model/EmploymentHistory";
import { serializeEmployee } from "@/lib/rbac";
import { getContext } from "@/lib/context";

export async function loadProfile(employeeId: string) {
  const employee: any = await Employee.findById(employeeId)
    .populate("designationId", "title")
    .populate("departmentId", "name")
    .populate("locationId", "name")
    .populate("gradeId", "name level")
    .populate("reportsTo", "displayName employeeCode designationId");

  if (!employee) return null;

  // Resolve the manager's designation separately — populating two levels deep
  // through a populated ref is more trouble than a second lookup.
  let manager: any = null;
  if (employee.reportsTo) {
    manager = await Employee.findById(employee.reportsTo._id)
      .select("displayName employeeCode photo designationId")
      .populate("designationId", "title")
      .lean();
  }

  const [membership, salary, documents, notices, history] = await Promise.all([
    Membership.findOne({ employeeId, status: "active" }).select("role").lean(),
    SalaryStructure.findOne({ employeeId, effectiveTo: null })
      .sort({ effectiveFrom: -1 })
      .lean(),
    DocumentModel.find({ employeeId }).sort({ createdAt: -1 }).lean(),
    HRNotice.find({ employeeId }).sort({ issuedAt: -1 }).limit(50).lean(),
    EmploymentHistory.find({ employeeId }).sort({ effectiveFrom: -1 }).limit(30).lean(),
  ]);

  return {
    // Masked by default. The edit form takes a new value rather than showing
    // the old one — rendering an account number just to allow editing it
    // exposes PII for no benefit.
    employee: serializeEmployee(employee),
    manager: manager
      ? {
          id: String(manager._id),
          displayName: manager.displayName,
          employeeCode: manager.employeeCode,
          designation: manager.designationId?.title ?? null,
          photo: manager.photo ?? null,
        }
      : null,
    role: (membership as any)?.role ?? null,
    salary,
    documents: {
      personal: documents.filter((d: any) => d.source === "personal"),
      company: documents.filter((d: any) => d.source === "company"),
    },
    notices,
    history,
  };
}

/** The signed-in person's own profile. */
export async function loadMyProfile() {
  const ctx = getContext();
  if (!ctx?.employeeId) return null;
  return loadProfile(ctx.employeeId);
}
