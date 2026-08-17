// app/admin/page.tsx — platform overview.

import Link from "next/link";
import { Building2, Users, UserRound, ShieldAlert, Trash2, ArrowRight } from "lucide-react";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { platformActivity, platformOverview } from "@/lib/services/platformQueries";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Platform · HRMS" };

const SEVERITY_TONE: Record<string, PillTone> = {
  critical: "danger",
  warning: "warning",
  info: "neutral",
};

export default async function AdminOverviewPage() {
  const { session, data } = await loadWithSession(async () => {
    const [stats, critical] = await Promise.all([
      platformOverview(),
      platformActivity({ severity: "critical", limit: 12 }),
    ]);
    return { stats, critical };
  });

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <PageHeader
        title="Platform"
        description="Every organisation on this deployment, and what has been done in them."
      />

      <StatGrid>
        <StatCard
          icon={Building2}
          label="Organisations"
          value={data.stats.orgs}
          sublabel={`${data.stats.activeOrgs} active`}
        />
        <StatCard
          icon={UserRound}
          label="Users"
          value={data.stats.users}
          sublabel="Excluding the super admin"
        />
        <StatCard
          icon={Users}
          label="Employees"
          value={data.stats.employees}
          sublabel="On roll across every organisation"
        />
        <StatCard
          icon={ShieldAlert}
          label="Critical, 24h"
          value={data.stats.criticalToday}
          tone={data.stats.criticalToday > 0 ? "danger" : "default"}
          sublabel="Role changes, purges, PII reveals, impersonation"
        />
        <StatCard
          icon={Trash2}
          label="Deletions, 7 days"
          value={data.stats.deletionsThisWeek}
          tone={data.stats.deletionsThisWeek > 0 ? "warning" : "default"}
          sublabel="All recoverable from the recycle bin"
        />
      </StatGrid>

      <section className="space-y-3">
        <SectionHeading
          title="Critical activity"
          description="The actions worth knowing about without going looking."
          actions={
            <Link
              href="/admin/activity"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              Full log
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          }
        />

        <div className="overflow-hidden rounded-lg border bg-surface">
          {data.critical.length === 0 ? (
            <p className="p-6 text-center text-sm text-muted-foreground">
              Nothing critical has happened recently.
            </p>
          ) : (
            <ul className="divide-y">
              {data.critical.map((a) => (
                <li key={a.id} className="flex flex-wrap items-center gap-3 p-4">
                  <StatusPill tone={SEVERITY_TONE[a.severity] ?? "neutral"}>
                    {a.action}
                  </StatusPill>
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="font-medium">{a.actorName}</span>
                    <span className="text-muted-foreground">
                      {" "}
                      · {a.org}
                      {a.entityLabel ? ` · ${a.entityLabel}` : ""}
                    </span>
                  </span>
                  <span className="text-xs text-subtle-foreground">
                    {formatDate(a.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </AppShell>
  );
}
