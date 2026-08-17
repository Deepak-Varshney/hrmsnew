// app/employees/[id]/page.tsx
//
// One person's record, as seen by whoever has the reach to open it.
//
// Read-only on purpose: edits go through the employee's own profile and the
// change-request queue, so there is exactly one write path for a person's
// details rather than two that can disagree.

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

    return { profile: await loadProfile(id) };
  });

  if ("denied" in data) redirect("/employees");
  if (!data.profile) notFound();

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <EmployeeRecordClient
        profile={JSON.parse(JSON.stringify(data.profile))}
        viewerRole={session.role}
      />
    </AppShell>
  );
}
