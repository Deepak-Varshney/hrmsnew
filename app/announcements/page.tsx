// app/announcements/page.tsx — server component.

import { Megaphone, Pin } from "lucide-react";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { PageHeader } from "@/components/ui/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { StatusPill } from "@/components/ui/status-pill";
import { requireOrgId } from "@/lib/context";
import { formatDate } from "@/lib/format";
import Announcement from "@/model/Announcement";
import User from "@/model/User";

export const metadata = { title: "Announcements · HRMS" };

export default async function AnnouncementsPage() {
  const { session, data } = await loadWithSession(async () => {
    const orgId = requireOrgId();
    const now = new Date();

    const rows: any[] = await Announcement.find({
      orgId,
      deletedAt: null,
      // An expired notice is noise, not history.
      $or: [{ expiresAt: null }, { expiresAt: { $exists: false } }, { expiresAt: { $gte: now } }],
    })
      .sort({ isPinned: -1, createdAt: -1 })
      .limit(50)
      .lean();

    const authors = await User.find({
      _id: { $in: rows.map((r) => r.createdBy).filter(Boolean) },
    })
      .select("name")
      .lean();
    const authorById = new Map(authors.map((a: any) => [String(a._id), a.name]));

    return rows.map((r) => ({
      id: String(r._id),
      title: r.title,
      content: r.content,
      isPinned: Boolean(r.isPinned),
      createdAt: r.createdAt,
      author: authorById.get(String(r.createdBy)) ?? "HR",
    }));
  });

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <PageHeader
        title="Announcements"
        description="Notices for everyone at the company. Anything addressed to you personally is under My profile."
      />

      {data.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          title="Nothing announced yet"
          description="Company-wide notices from HR appear here — holidays, policy changes, new joiners. Pinned ones stay at the top."
        />
      ) : (
        <ul className="space-y-3">
          {data.map((a) => (
            <li
              key={a.id}
              className={`rounded-lg border bg-surface p-4 sm:p-5 ${
                a.isPinned ? "border-primary/30" : ""
              }`}
            >
              <div className="flex flex-wrap items-center gap-2">
                {a.isPinned ? (
                  <StatusPill tone="primary" dot={false}>
                    <Pin className="h-3 w-3" aria-hidden />
                    Pinned
                  </StatusPill>
                ) : null}
                <h2 className="text-base font-semibold">{a.title}</h2>
                <span className="ml-auto text-xs text-subtle-foreground">
                  {formatDate(a.createdAt)}
                </span>
              </div>

              <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {a.content}
              </p>

              <p className="mt-3 text-xs text-subtle-foreground">Posted by {a.author}</p>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
