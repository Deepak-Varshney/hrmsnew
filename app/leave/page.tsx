// app/leave/page.tsx — server component, everything loaded before render.

import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import {
  myLeaveBalances,
  myLeaveRequests,
  teamLeaveRequests,
} from "@/lib/services/leaveService";
import { LeaveClient } from "./LeaveClient";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "Leaves · HRMS" };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const year = Number(params.year) || new Date().getFullYear();

  const { session, data } = await loadWithSession(async () => {
    const scope = can("leave.read");
    const seesTeam = scope === "team" || scope === "org";

    const [balances, mine, team] = await Promise.all([
      myLeaveBalances(year),
      myLeaveRequests(year),
      seesTeam ? teamLeaveRequests() : Promise.resolve([]),
    ]);

    return { balances, mine, team, seesTeam, year };
  });

  return (
    <AppShell session={plain(session)}>
      <LeaveClient
        balances={plain(data.balances)}
        mine={plain(data.mine) as any}
        team={plain(data.team) as any}
        seesTeam={data.seesTeam}
        year={data.year}
      />
    </AppShell>
  );
}
