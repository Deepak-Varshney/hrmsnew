// app/profile/page.tsx
//
// Server component — the whole profile, every tab, loaded in one pass.
// Switching tabs is then instant because nothing else has to be fetched.

import { redirect } from "next/navigation";
import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { loadMyProfile } from "@/lib/services/profileQueries";
import { isCloudinaryConfigured } from "@/lib/cloudinary";
import { ProfileClient } from "./ProfileClient";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "My profile · HRMS" };

export default async function ProfilePage() {
  const { session, data } = await loadWithSession(async () => ({
    profile: await loadMyProfile(),
    storageReady: isCloudinaryConfigured(),
  }));

  // A super admin has no employee record, so there is no profile to show.
  if (!data.profile) redirect("/dashboard");

  return (
    <AppShell session={plain(session)}>
      <ProfileClient
        profile={plain(data.profile)}
        role={session.role}
        email={session.user.email}
        storageReady={data.storageReady}
      />
    </AppShell>
  );
}
