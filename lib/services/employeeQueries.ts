// lib/services/employeeQueries.ts
//
// Read paths for employees, shared by the API routes and the server
// components that render pages. Both call these inside a request context, so
// tenant scoping and RBAC apply identically either way.
//
// Keeping the query in one place is what stops a page and its API drifting
// into showing different rows for the same person.

import Employee from "@/model/Employee";
import Department from "@/model/Department";
import { can, employeeFilterForScope, serializeEmployees } from "@/lib/rbac";

export interface EmployeeListParams {
  search?: string;
  status?: string;
  departmentId?: string;
  locationId?: string;
  page?: number;
  limit?: number;
}

export async function listEmployees(params: EmployeeListParams = {}) {
  const page = Math.max(1, Number(params.page ?? 1));
  const limit = Math.min(200, Math.max(1, Number(params.limit ?? 50)));

  const scope = can("employee.read");
  const filter: Record<string, any> = await employeeFilterForScope(scope);

  if (params.departmentId) filter.departmentId = params.departmentId;
  if (params.locationId) filter.locationId = params.locationId;
  if (params.status) filter["employment.status"] = params.status;

  if (params.search) {
    const rx = { $regex: params.search, $options: "i" };
    filter.$or = [
      { displayName: rx },
      { employeeCode: rx },
      { "contact.workEmail": rx },
    ];
  }

  const [rows, total] = await Promise.all([
    Employee.find(filter)
      // PII is never needed for a list. Excluding it at the query means it
      // cannot leak even if a caller forgets to serialize.
      .select("-statutory -bank")
      .populate("departmentId", "name code")
      .populate("designationId", "title code")
      .populate("locationId", "name code")
      .populate("reportsTo", "displayName employeeCode")
      .sort({ displayName: 1 })
      .skip((page - 1) * limit)
      .limit(limit),
    Employee.countDocuments(filter),
  ]);

  return {
    employees: serializeEmployees(rows),
    pagination: { page, limit, total, pages: Math.ceil(total / limit) || 1 },
  };
}

export interface HeadcountSummary {
  onRoll: number;
  total: number;
  active: number;
  probation: number;
  noticePeriod: number;
  onLeave: number;
  departed: number;
  largestTeam: { name: string; count: number } | null;
}

export async function employeeSummary(): Promise<HeadcountSummary> {
  const scope = can("employee.read");
  const base = await employeeFilterForScope(scope);

  const [byStatus, byDepartment] = await Promise.all([
    Employee.aggregate([
      { $match: base },
      { $group: { _id: "$employment.status", count: { $sum: 1 } } },
    ]),
    Employee.aggregate([
      { $match: { ...base, "employment.status": { $ne: "exited" } } },
      { $group: { _id: "$departmentId", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 1 },
    ]),
  ]);

  const counts: Record<string, number> = {};
  for (const row of byStatus) counts[row._id ?? "unknown"] = row.count;

  const active = counts.active ?? 0;
  const probation = counts.probation ?? 0;
  const noticePeriod = counts["notice-period"] ?? 0;
  const onLeave = counts["on-leave"] ?? 0;
  const departed = counts.exited ?? 0;
  const onRoll = active + probation + noticePeriod + onLeave;

  let largestTeam: { name: string; count: number } | null = null;
  if (byDepartment[0]?._id) {
    const dept = await Department.findById(byDepartment[0]._id).select("name").lean();
    if (dept) largestTeam = { name: (dept as any).name, count: byDepartment[0].count };
  }

  return {
    onRoll,
    total: onRoll + departed,
    active,
    probation,
    noticePeriod,
    onLeave,
    departed,
    largestTeam,
  };
}

/** Filter options for the employees page, so dropdowns show real values. */
export async function employeeFilterOptions() {
  const [departments, locations] = await Promise.all([
    Department.find({ isActive: true }).select("name code").sort({ name: 1 }).lean(),
    (await import("@/model/Location")).default
      .find({ isActive: true })
      .select("name code")
      .sort({ name: 1 })
      .lean(),
  ]);

  return {
    departments: departments.map((d: any) => ({ id: String(d._id), name: d.name })),
    locations: locations.map((l: any) => ({ id: String(l._id), name: l.name })),
  };
}
