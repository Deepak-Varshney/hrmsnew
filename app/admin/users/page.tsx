// app/admin/users/page.tsx

import Link from "next/link";
import { Users } from "lucide-react";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { listPlatformUsers } from "@/lib/services/platformQueries";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Users · HRMS" };

const ROLE_TONE: Record<string, PillTone> = {
  ADMIN: "primary",
  MANAGER: "info",
  LEAD: "info",
  EMPLOYEE: "neutral",
};

export default async function PlatformUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const search = typeof params.search === "string" ? params.search : "";

  const { session, data } = await loadWithSession(() =>
    listPlatformUsers(search),
  );

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <PageHeader
        title="Users"
        description="Every login on the platform, and which organisations they belong to."
      />

      <form className="flex gap-2" action="/admin/users">
        <input
          name="search"
          defaultValue={search}
          placeholder="Search name or email"
          aria-label="Search users"
          className="h-9 flex-1 rounded-md border bg-surface px-3 text-sm"
        />
        <button
          type="submit"
          className="h-9 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Search
        </button>
      </form>

      <div className="overflow-hidden rounded-lg border bg-surface">
        {data.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={Users}
            title="No users match"
            description="Try a different name or email address."
          />
        ) : (
          <ul className="divide-y">
            {data.map((u) => (
              <li key={u.id} className="flex flex-wrap items-center gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                    {u.name}
                    {u.isSuperAdmin ? (
                      <StatusPill tone="danger" dot={false}>
                        Super admin
                      </StatusPill>
                    ) : null}
                    {u.status === "suspended" ? (
                      <StatusPill tone="warning">Suspended</StatusPill>
                    ) : null}
                  </p>
                  <p className="text-xs text-subtle-foreground">{u.email}</p>

                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {u.memberships.map((m, i) => (
                      <StatusPill
                        key={i}
                        tone={ROLE_TONE[m.role] ?? "neutral"}
                        dot={false}
                      >
                        {m.org} · {m.role}
                      </StatusPill>
                    ))}
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-xs text-subtle-foreground">
                    {u.lastLoginAt
                      ? `Last in ${formatDate(u.lastLoginAt)}`
                      : "Never signed in"}
                  </p>
                  <Link
                    href={`/admin/activity?actorId=${u.id}`}
                    className="text-sm text-primary hover:underline"
                  >
                    View trail
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppShell>
  );
}
