// app/requests/page.tsx
//
// HR's queue of employee change requests. Without this the requests pile up
// unseen and self-service silently stops working.

import { redirect } from "next/navigation";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import { listChangeRequests } from "@/lib/services/changeRequests";
import { RequestsClient } from "./RequestsClient";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "Change requests · HRMS" };

export default async function RequestsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const status = typeof params.status === "string" ? params.status : "pending";

  const { session, data } = await loadWithSession(async () => {
    if (can("changerequest.approve") === "none") return null;
    return { requests: await listChangeRequests(status), status };
  });

  if (!data) redirect("/dashboard");

  return (
    <AppShell session={plain(session)}>
      <RequestsClient requests={plain(data.requests) as any} status={data.status} />
    </AppShell>
  );
}
