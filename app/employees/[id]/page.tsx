// app/employees/[id]/page.tsx
//
// One person's record, as seen by whoever has the reach to open it.
//
// Editing is a separate page rather than inline fields, because an admin
// writing here is a different act from an employee editing their own profile:
// this one saves immediately, that one raises a change request.

import { notFound, redirect } from "next/navigation";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can, isWithinScope } from "@/lib/rbac";
import { loadProfile } from "@/lib/services/profileQueries";
import { EmployeeRecordClient } from "./EmployeeRecordClient";

export const metadata = { title: "Employee · HRMS" };

export default async function EmployeeRecordPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { session, data } = await loadWithSession(async () => {
    const scope = can("employee.read");
    if (scope === "none") return { denied: true as const };

    // A manager may only open someone inside their own subtree. Checked before
    // the record is loaded, so an out-of-reach id reveals nothing at all.
    if (!(await isWithinScope(scope, id))) return { denied: true as const };

    const updateScope = can("employee.update");
    const deleteScope = can("employee.delete");

    return {
      profile: await loadProfile(id),
      canEdit: updateScope !== "none" && (await isWithinScope(updateScope, id)),
      canDelete:
        deleteScope !== "none" && (await isWithinScope(deleteScope, id)),
    };
  });

  if ("denied" in data) redirect("/employees");
  if (!data.profile) notFound();

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <EmployeeRecordClient
        profile={JSON.parse(JSON.stringify(data.profile))}
        viewerRole={session.role}
        employeeId={id}
        canEdit={data.canEdit}
        canDelete={data.canDelete && session.employeeId !== id}
      />
    </AppShell>
  );
}
