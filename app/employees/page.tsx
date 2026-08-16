// app/employees/page.tsx
//
// Server component. Data is loaded in-process inside the caller's tenant
// context — no HTTP round trip back into our own API, and nothing sensitive
// is fetched from the browser.
//
// Filters live in the URL, so the server re-renders on change and a filtered
// view can be linked to or bookmarked.

import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import {
  employeeFilterOptions,
  employeeSummary,
  listEmployees,
} from "@/lib/services/employeeQueries";
import { EmployeesClient, type EmployeeRow } from "./EmployeesClient";

/** Mongoose documents carry ObjectIds and Dates, which cannot cross the RSC
 *  boundary as-is. */
function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "Employees · HRMS" };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : "";
  const status = typeof params.status === "string" ? params.status : "";
  const departmentId =
    typeof params.departmentId === "string" ? params.departmentId : "";

  const { session, data } = await loadWithSession(async () => {
    const [list, summary, options] = await Promise.all([
      listEmployees({ search, status, departmentId, limit: 100 }),
      employeeSummary(),
      employeeFilterOptions(),
    ]);
    return { list, summary, options };
  });

  return (
    <AppShell session={plain(session)}>
      <EmployeesClient
        employees={plain(data.list.employees) as EmployeeRow[]}
        pagination={data.list.pagination}
        summary={data.summary}
        options={data.options}
        filters={{ search, status, departmentId }}
        role={session.role}
        orgName={session.org?.name ?? null}
      />
    </AppShell>
  );
}
