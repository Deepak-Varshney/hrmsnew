// app/employees/[id]/edit/page.tsx
//
// An admin edits a record directly. An employee editing their own details goes
// through /profile and the change-request queue instead — the API enforces
// that split, this page only exists for people who can write.

import { notFound, redirect } from "next/navigation";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can, isWithinScope } from "@/lib/rbac";
import { loadProfile } from "@/lib/services/profileQueries";
import { loadEmployeeFormOptions } from "@/lib/services/employeeForm";
import { EmployeeForm, type EmployeeFormValues } from "../../EmployeeForm";

export const metadata = { title: "Edit employee · HRMS" };

/** `<input type="date">` wants yyyy-mm-dd and nothing else. */
function dateInput(value?: string | Date | null): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
}

export default async function EditEmployeePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { session, data } = await loadWithSession(async () => {
    const scope = can("employee.update");
    if (scope === "none") return { denied: true as const };
    if (!(await isWithinScope(scope, id))) return { denied: true as const };

    const [profile, options] = await Promise.all([
      loadProfile(id),
      loadEmployeeFormOptions(id),
    ]);
    return { profile, options };
  });

  if ("denied" in data) redirect(`/employees/${id}`);
  if (!data.profile) notFound();

  const e: any = data.profile.employee ?? {};
  const emp = e.employment ?? {};
  const contact = e.contact ?? {};

  const initial: EmployeeFormValues = {
    firstName: e.firstName ?? "",
    middleName: e.middleName ?? "",
    lastName: e.lastName ?? "",
    employeeCode: e.employeeCode ?? "",
    dateOfBirth: dateInput(e.dateOfBirth),
    gender: e.gender ?? "",
    workEmail: contact.workEmail ?? "",
    personalEmail: contact.personalEmail ?? "",
    personalPhone: contact.personalPhone ?? "",
    workPhone: contact.workPhone ?? "",
    dateOfJoining: dateInput(emp.dateOfJoining),
    employmentType: emp.employmentType ?? "full-time",
    workMode: emp.workMode ?? "onsite",
    status: emp.status ?? "active",
    probationMonths: String(emp.probationMonths ?? 6),
    departmentId: e.departmentId?._id ? String(e.departmentId._id) : "",
    designationId: e.designationId?._id ? String(e.designationId._id) : "",
    gradeId: e.gradeId?._id ? String(e.gradeId._id) : "",
    locationId: e.locationId?._id ? String(e.locationId._id) : "",
    reportsTo: data.profile.manager?.id ?? "",
  };

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <EmployeeForm
        mode="edit"
        employeeId={id}
        options={JSON.parse(JSON.stringify(data.options))}
        initial={initial}
      />
    </AppShell>
  );
}
