// app/employees/new/page.tsx — onboard someone.

import { redirect } from "next/navigation";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import { loadEmployeeFormOptions } from "@/lib/services/employeeForm";
import { EmployeeForm, EMPTY_EMPLOYEE } from "../EmployeeForm";

export const metadata = { title: "Add an employee · HRMS" };

export default async function NewEmployeePage() {
  const { session, data } = await loadWithSession(async () => {
    if (can("employee.create") === "none") return null;
    return loadEmployeeFormOptions();
  });

  if (!data) redirect("/employees");

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <EmployeeForm
        mode="create"
        options={JSON.parse(JSON.stringify(data))}
        initial={EMPTY_EMPLOYEE}
      />
    </AppShell>
  );
}
