// app/payroll/page.tsx
//
// Server component. Everything is loaded before render, so there is no
// spinner and no layout shift — the page arrives complete.

import { loadWithSession } from "@/lib/session";
import { AppShell } from "@/components/app/AppShell";
import { can } from "@/lib/rbac";
import {
  availableMonths,
  defaultMonth,
  myPayslip,
  payrollForMonth,
} from "@/lib/services/payrollQueries";
import { PayrollClient, type FullPayslip } from "./PayrollClient";

function plain<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

export const metadata = { title: "Payroll · HRMS" };

export default async function PayrollPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const requested = typeof params.month === "string" ? params.month : undefined;

  const { session, data } = await loadWithSession(async () => {
    const canRun = can("payroll.run") !== "none";
    const withPayslips = await availableMonths();

    // Someone who can run payroll needs to select a month that has no
    // payslips yet — that is the whole point of generating one. Everyone
    // else only sees months that actually have something to show.
    const months = canRun
      ? Array.from(
          new Set([
            ...withPayslips,
            ...Array.from({ length: 12 }, (_, i) => {
              const d = new Date();
              d.setMonth(d.getMonth() - i);
              return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
            }),
          ])
        ).sort().reverse()
      : withPayslips;

    // Default to the newest month that actually has payslips, not the
    // current one — payroll is generated after a month closes.
    const month = requested ?? (await defaultMonth()) ?? months[0] ?? null;

    if (!month) {
      return { months, month: null, payroll: null, own: null, scope: can("payroll.read"), canRun };
    }

    const [payroll, own] = await Promise.all([
      payrollForMonth(month),
      myPayslip(month),
    ]);

    return { months, month, payroll, own, scope: can("payroll.read"), canRun };
  });

  return (
    <AppShell session={plain(session)}>
      <PayrollClient
        months={data.months}
        month={data.month}
        payroll={plain(data.payroll)}
        ownPayslip={plain(data.own) as FullPayslip | null}
        scope={data.scope}
        canRun={data.canRun}
        role={session.role}
        orgName={session.org?.name ?? null}
      />
    </AppShell>
  );
}
