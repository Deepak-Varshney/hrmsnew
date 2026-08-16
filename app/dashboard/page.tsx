// app/dashboard/page.tsx
//
// Server component. Every panel is loaded before render — the page arrives
// complete, with no spinner and no shift as data lands.
//
// What appears depends on the reader: an employee sees their own day and
// month; leadership additionally sees the team, headcount and payroll.

import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import {
  attendanceFlags,
  monthKeyOf,
  myMonthSummary,
  myToday,
  teamToday,
} from "@/lib/services/attendanceQueries";
import { employeeSummary } from "@/lib/services/employeeQueries";
import { defaultMonth, payrollForMonth } from "@/lib/services/payrollQueries";
import { DashboardClient } from "./DashboardClient";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "Dashboard · HRMS" };

export default async function DashboardPage() {
  const { session, data } = await loadWithSession(async () => {
    const month = monthKeyOf();

    const attendanceScope = can("attendance.read");
    const seesTeam = attendanceScope === "team" || attendanceScope === "org";
    const employeeScope = can("employee.read");
    const seesHeadcount = employeeScope === "team" || employeeScope === "org";
    const payrollScope = can("payroll.read");
    const seesPayroll = payrollScope === "team" || payrollScope === "org";

    const [today, summary, team, flags, headcount, payroll] = await Promise.all([
      myToday(),
      myMonthSummary(month),
      seesTeam ? teamToday() : Promise.resolve({ members: [], markedIn: 0 }),
      seesTeam ? attendanceFlags(month) : Promise.resolve([]),
      seesHeadcount ? employeeSummary() : Promise.resolve(null),
      seesPayroll
        ? defaultMonth().then((m) =>
            m ? payrollForMonth(m).then((r) => ({ ...r, month: m })) : null
          )
        : Promise.resolve(null),
    ]);

    return { month, today, summary, team, flags, headcount, payroll };
  });

  const displayName = session.employee?.displayName ?? session.user.name;

  return (
    <AppShell session={plain(session)}>
      <DashboardClient
        firstName={displayName.split(" ")[0]}
        fullName={displayName}
        month={data.month}
        today={plain(data.today)}
        summary={plain(data.summary)}
        team={plain(data.team)}
        flags={plain(data.flags)}
        headcount={plain(data.headcount)}
        payroll={plain(data.payroll)}
      />
    </AppShell>
  );
}
