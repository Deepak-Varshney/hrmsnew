// app/attendance/page.tsx — server component.

import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import {
  monthKeyOf,
  myMonthRecords,
  myMonthSummary,
  myToday,
  teamOnDate,
  todayKey,
} from "@/lib/services/attendanceQueries";
import { AttendanceClient } from "./AttendanceClient";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "Attendance · HRMS" };

export default async function AttendancePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const month = typeof params.month === "string" ? params.month : monthKeyOf();
  const teamDate = typeof params.date === "string" ? params.date : todayKey();

  const { session, data } = await loadWithSession(async () => {
    const scope = can("attendance.read");
    const seesTeam = scope === "team" || scope === "org";

    const [today, summary, records, team] = await Promise.all([
      myToday(),
      myMonthSummary(month),
      myMonthRecords(month),
      seesTeam ? teamOnDate(teamDate) : Promise.resolve({ members: [], markedIn: 0 }),
    ]);

    return { today, summary, records, team, seesTeam, month, teamDate };
  });

  // Twelve months back is enough for any correction someone needs to look up.
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date();
    d.setMonth(d.getMonth() - i);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });

  return (
    <AppShell session={plain(session)}>
      <AttendanceClient
        today={plain(data.today)}
        summary={plain(data.summary)}
        records={plain(data.records)}
        team={plain(data.team)}
        seesTeam={data.seesTeam}
        month={data.month}
        months={months}
        teamDate={data.teamDate}
      />
    </AppShell>
  );
}
