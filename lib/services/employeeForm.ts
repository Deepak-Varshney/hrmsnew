// lib/services/employeeForm.ts
//
// Everything the add/edit employee form needs to render its dropdowns, in one
// pass on the server so the form never opens empty and fills in later.

import Employee from "@/model/Employee";
import Department from "@/model/Department";
import Designation from "@/model/Designation";
import Grade from "@/model/Grade";
import Location from "@/model/Location";
import { assertCan } from "@/lib/rbac";

export interface FormOption {
  id: string;
  label: string;
}

export interface EmployeeFormOptions {
  departments: FormOption[];
  designations: FormOption[];
  grades: FormOption[];
  locations: FormOption[];
  /** Anyone who could be someone's reporting manager. */
  managers: FormOption[];
}

export async function loadEmployeeFormOptions(
  excludeEmployeeId?: string,
): Promise<EmployeeFormOptions> {
  await assertCan("master.read");

  const [departments, designations, grades, locations, people] =
    await Promise.all([
      Department.find({ isActive: true })
        .select("name")
        .sort({ name: 1 })
        .lean(),
      Designation.find({ isActive: true })
        .select("title")
        .sort({ title: 1 })
        .lean(),
      Grade.find({ isActive: true })
        .select("name level")
        .sort({ level: 1 })
        .lean(),
      Location.find({ isActive: true }).select("name").sort({ name: 1 }).lean(),
      Employee.find({ "employment.status": { $ne: "exited" } })
        .select("displayName employeeCode")
        .sort({ displayName: 1 })
        .limit(500)
        .lean(),
    ]);

  return {
    departments: departments.map((d: any) => ({
      id: String(d._id),
      label: d.name,
    })),
    designations: designations.map((d: any) => ({
      id: String(d._id),
      label: d.title,
    })),
    grades: grades.map((g: any) => ({ id: String(g._id), label: g.name })),
    locations: locations.map((l: any) => ({
      id: String(l._id),
      label: l.name,
    })),
    // A person cannot report to themselves; the API also rejects longer cycles.
    managers: people
      .filter((p: any) => String(p._id) !== excludeEmployeeId)
      .map((p: any) => ({
        id: String(p._id),
        label: `${p.displayName} (${p.employeeCode})`,
      })),
  };
}
