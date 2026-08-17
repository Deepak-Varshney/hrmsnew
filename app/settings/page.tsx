// app/settings/page.tsx
//
// Server component — the whole settings page in one pass, so switching tabs
// never waits on a fetch.

import { redirect } from "next/navigation";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import { loadSettingsPage } from "@/lib/services/settingsService";
import { SettingsClient } from "./SettingsClient";

export const metadata = { title: "Settings · HRMS" };

export default async function SettingsPage() {
  const { session, data } = await loadWithSession(async () => {
    // Checked here rather than letting the service throw: an unauthorised
    // visitor should land somewhere useful, not on an error page.
    if (can("org.settings") === "none") return null;
    return loadSettingsPage();
  });

  if (!data) redirect("/dashboard");

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <SettingsClient
        org={data.org}
        masters={data.masters}
        statutory={data.statutory}
        canEdit={session.role === "ADMIN" || session.user.isSuperAdmin}
      />
    </AppShell>
  );
}
