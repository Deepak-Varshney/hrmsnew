// app/admin/orgs/page.tsx

import Link from "next/link";
import { Building2 } from "lucide-react";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { listOrganisations } from "@/lib/services/platformQueries";
import { formatDate } from "@/lib/format";
import { EnterAdminMode } from "./EnterAdminMode";

export const metadata = { title: "Organisations · HRMS" };

const STATUS_TONE: Record<string, PillTone> = {
  active: "success",
  trial: "info",
  suspended: "danger",
};

export default async function OrgsPage() {
  const { session, data } = await loadWithSession(() => listOrganisations());

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <PageHeader
        title="Organisations"
        description="Every tenant on this deployment. Admin mode drops you inside one as its administrator."
      />

      <div className="overflow-hidden rounded-lg border bg-surface">
        {data.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={Building2}
            title="No organisations"
            description="Tenants appear here once created. Each one owns its own employees, payroll and activity log."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="eyebrow px-4 py-3 font-semibold">
                    Organisation
                  </th>
                  <th className="eyebrow px-4 py-3 font-semibold">Status</th>
                  <th className="eyebrow px-4 py-3 text-right font-semibold">
                    Employees
                  </th>
                  <th className="eyebrow px-4 py-3 text-right font-semibold">
                    Admins
                  </th>
                  <th className="eyebrow hidden px-4 py-3 font-semibold sm:table-cell">
                    Created
                  </th>
                  <th className="eyebrow px-4 py-3 text-right font-semibold">
                    Manage
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((org) => (
                  <tr
                    key={org.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <td className="px-4 py-3">
                      <span className="block font-medium">{org.name}</span>
                      <span className="block text-xs text-subtle-foreground">
                        /{org.slug}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={STATUS_TONE[org.status] ?? "neutral"}>
                        {org.status}
                      </StatusPill>
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {org.employees}
                    </td>
                    <td className="tabular px-4 py-3 text-right">
                      {org.admins}
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground sm:table-cell">
                      {formatDate(org.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-3">
                        <Link
                          href={`/admin/activity?orgId=${org.id}`}
                          className="whitespace-nowrap text-sm text-primary hover:underline"
                        >
                          View log
                        </Link>
                        <EnterAdminMode slug={org.slug} name={org.name} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </AppShell>
  );
}
