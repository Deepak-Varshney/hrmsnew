// app/admin/recycle-bin/page.tsx

import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { recycleBin } from "@/lib/services/platformQueries";
import { RecycleBinClient } from "./RecycleBinClient";

export const metadata = { title: "Recycle bin · HRMS" };

export default async function RecycleBinPage() {
  const { session, data } = await loadWithSession(() => recycleBin());

  return (
    <AppShell session={JSON.parse(JSON.stringify(session))}>
      <RecycleBinClient items={JSON.parse(JSON.stringify(data))} />
    </AppShell>
  );
}
