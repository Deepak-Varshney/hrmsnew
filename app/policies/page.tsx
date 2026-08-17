// app/policies/page.tsx — server component.

import { ScrollText } from "lucide-react";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { requireOrgId } from "@/lib/context";
import Policy from "@/model/Policy";

export const metadata = { title: "Policies · HRMS" };

export default async function PoliciesPage() {
  const { session, data } = await loadWithSession(async () => {
    const orgId = requireOrgId();
    const rows: any[] = await Policy.find({ orgId, deletedAt: null })
      .sort({ category: 1, title: 1 })
      .lean();

    // Grouped by category so a long list stays navigable.
    const grouped = new Map<string, any[]>();
    for (const row of rows) {
      const key = row.category ?? "General";
      grouped.set(key, [...(grouped.get(key) ?? []), row]);
    }

    return Array.from(grouped.entries()).map(([category, items]) => ({
      category,
      items: items.map((i) => ({
        id: String(i._id),
        title: i.title,
        content: i.content,
      })),
    }));
  });

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <PageHeader
        title="Policies"
        description="How things work here — attendance, leave, and the rest. Worth reading before you need them."
      />

      {data.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title="No policies published"
          description="Company policies appear here once HR publishes them, grouped by area."
        />
      ) : (
        <div className="space-y-6">
          {data.map((group) => (
            <section key={group.category} className="space-y-3">
              <p className="eyebrow">{group.category}</p>
              {group.items.map((policy) => (
                <article key={policy.id} className="rounded-lg border bg-surface p-4 sm:p-5">
                  <h2 className="text-base font-semibold">{policy.title}</h2>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {policy.content}
                  </p>
                </article>
              ))}
            </section>
          ))}
        </div>
      )}
    </AppShell>
  );
}
