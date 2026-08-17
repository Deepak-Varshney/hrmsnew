// app/activity/page.tsx
//
// The org's own activity log. Same data as the platform console, narrowed to
// one tenant by the request context rather than by a filter on the page.

import Link from "next/link";
import { ScrollText } from "lucide-react";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { orgActivity } from "@/lib/services/activityQueries";

export const metadata = { title: "Activity log · HRMS" };

const SEVERITY_TONE: Record<string, PillTone> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};

const ROLE_TABS = [
  { value: "", label: "Everyone" },
  { value: "ADMIN", label: "Admins" },
  { value: "MANAGER", label: "Managers" },
  { value: "LEAD", label: "Leads" },
  { value: "EMPLOYEE", label: "Employees" },
];

function when(value: string) {
  return new Date(value).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

export default async function OrgActivityPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const actorRole =
    typeof params.actorRole === "string" ? params.actorRole : "";
  const severity = typeof params.severity === "string" ? params.severity : "";

  const { session, data } = await loadWithSession(() =>
    orgActivity({
      actorRole: actorRole || undefined,
      severity: severity || undefined,
    }),
  );

  const query = (next: Record<string, string>) => {
    const p = new URLSearchParams({ actorRole, severity, ...next });
    for (const [k, v] of [...p.entries()]) if (!v) p.delete(k);
    return `/activity${p.toString() ? `?${p}` : ""}`;
  };

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <PageHeader
        title="Activity log"
        description="Every change made in this organisation. Append-only — entries cannot be edited or removed."
      />

      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b">
          {ROLE_TABS.map((t) => {
            const active = actorRole === t.value;
            return (
              <Link
                key={t.value || "all"}
                href={query({ actorRole: t.value })}
                className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {t.label}
              </Link>
            );
          })}
        </div>
      </div>

      <Link
        href={query({ severity: severity === "critical" ? "" : "critical" })}
        className={`inline-block rounded-md border px-3 py-1.5 text-sm transition-colors ${
          severity === "critical"
            ? "border-danger/40 bg-danger/10 text-danger"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Critical only
      </Link>

      <div className="overflow-hidden rounded-lg border bg-surface">
        {data.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={ScrollText}
            title="Nothing matches"
            description="No activity recorded for those filters yet."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="eyebrow px-4 py-3 font-semibold">When</th>
                  <th className="eyebrow px-4 py-3 font-semibold">Who</th>
                  <th className="eyebrow px-4 py-3 font-semibold">Action</th>
                  <th className="eyebrow hidden px-4 py-3 font-semibold md:table-cell">
                    Subject
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.map((a) => (
                  <tr
                    key={a.id}
                    className="transition-colors hover:bg-muted/40"
                  >
                    <td className="tabular whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {when(a.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block font-medium">{a.actorName}</span>
                      <span className="block text-xs text-subtle-foreground">
                        {a.actorRole}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusPill tone={SEVERITY_TONE[a.severity] ?? "neutral"}>
                        {a.action}
                      </StatusPill>
                    </td>
                    <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                      {a.entityLabel ?? a.entityType}
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
