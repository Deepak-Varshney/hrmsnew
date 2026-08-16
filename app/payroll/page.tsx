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
    const months = await availableMonths();
    // Default to the newest month that actually has payslips, not the
    // current one — payroll is generated after a month closes.
    const month = requested ?? (await defaultMonth());

    if (!month) {
      return { months, month: null, payroll: null, own: null, scope: can("payroll.read") };
    }

    const [payroll, own] = await Promise.all([
      payrollForMonth(month),
      myPayslip(month),
    ]);

    return { months, month, payroll, own, scope: can("payroll.read") };
  });

  return (
    <AppShell session={plain(session)}>
      <PayrollClient
        months={data.months}
        month={data.month}
        payroll={plain(data.payroll)}
        ownPayslip={plain(data.own) as FullPayslip | null}
        scope={data.scope}
        role={session.role}
        orgName={session.org?.name ?? null}
      />
    </AppShell>
  );
}
