"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  Users,
  Download,
  FileText,
  Receipt,
} from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatINR, formatDate, monthLabel, monthLabelShort } from "@/lib/format";

interface PayslipRow {
  id: string;
  employeeCode: string;
  displayName: string;
  designation: string | null;
  department: string | null;
  paidDays: number;
  workingDays: number;
  lopDays: number;
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
}

interface Line {
  code: string;
  name: string;
  amount: number;
  isStatutory?: boolean;
}

export interface FullPayslip {
  month: string;
  snapshot: {
    employeeCode: string;
    displayName: string;
    designation: string | null;
    department: string | null;
    location: string | null;
    dateOfJoining: string | null;
    bankName: string | null;
    bankAccountTail: string | null;
  };
  attendance: { workingDays: number; paidDays: number; lopDays: number };
  earnings: Line[];
  deductions: Line[];
  employerContributions: Line[];
  grossEarnings: number;
  totalDeductions: number;
  netPay: number;
  employerCost: number;
  netPayInWords: string;
}

const RUN_TONE: Record<string, PillTone> = {
  draft: "neutral",
  computed: "warning",
  approved: "info",
  paid: "success",
};

function describeScope(scope: string, role: string, orgName: string | null) {
  if (scope === "org") return `Register for ${orgName ?? "the organisation"}.`;
  if (scope === "team") return "Your team's register — read-only for your reports.";
  return "Your payslips. Pick a month to view or download it.";
}

export function PayrollClient({
  months,
  month,
  payroll,
  ownPayslip,
  scope,
  role,
  orgName,
}: {
  months: string[];
  month: string | null;
  payroll: { payslips: PayslipRow[]; totals: any; run: any } | null;
  ownPayslip: FullPayslip | null;
  scope: string;
  role: string;
  orgName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const showsRegister = scope === "org" || scope === "team";

  function selectMonth(next: string) {
    startTransition(() => router.push(`/payroll?month=${next}`));
  }

  return (
    <>
      <PageHeader
        title="Payroll"
        description={
          month
            ? `${monthLabel(month)} — ${describeScope(scope, role, orgName)}`
            : describeScope(scope, role, orgName)
        }
        actions={
          months.length > 0 ? (
            <>
              <select
                value={month ?? ""}
                onChange={(e) => selectMonth(e.target.value)}
                disabled={pending}
                aria-label="Payroll month"
                className="h-9 rounded-md border bg-surface px-3 text-sm"
              >
                {months.map((m) => (
                  <option key={m} value={m}>
                    {monthLabelShort(m)}
                  </option>
                ))}
              </select>
              {payroll?.run ? (
                <StatusPill tone={RUN_TONE[payroll.run.status] ?? "neutral"}>
                  {payroll.run.status === "paid"
                    ? `Paid ${formatDate(payroll.run.paidAt)}`
                    : payroll.run.status}
                </StatusPill>
              ) : null}
            </>
          ) : null
        }
      />

      {!month || !payroll ? (
        <EmptyState
          icon={Receipt}
          title="No payroll yet"
          description="Payroll is generated once a month closes, because it reads that month's attendance. Nothing has been run for this organisation so far."
        />
      ) : (
        <>
          <StatGrid>
            <StatCard
              icon={TrendingUp}
              label="Total gross"
              value={formatINR(payroll.totals.grossEarnings)}
              sublabel="Earnings before any deduction"
            />
            <StatCard
              icon={TrendingDown}
              label="Deductions"
              value={formatINR(payroll.totals.totalDeductions)}
              tone="danger"
              sublabel="PF, ESI, professional tax and TDS"
            />
            <StatCard
              icon={Wallet}
              label="Net payable"
              value={formatINR(payroll.totals.netPayable)}
              tone="info"
              sublabel="What actually reaches bank accounts"
            />
            <StatCard
              icon={Users}
              label={showsRegister ? "Employees" : "Cost to company"}
              value={
                showsRegister
                  ? payroll.totals.payslipCount
                  : formatINR(payroll.totals.employerCost)
              }
              sublabel={
                showsRegister
                  ? `${payroll.totals.payslipCount} payslip${payroll.totals.payslipCount === 1 ? "" : "s"} generated`
                  : "Gross plus employer PF and ESI"
              }
            />
          </StatGrid>

          {/* The viewer's own payslip, in full. */}
          {ownPayslip ? (
            <section className="rounded-lg border bg-surface">
              <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-base font-semibold">Your payslip</h2>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {monthLabel(ownPayslip.month)} ·{" "}
                    {ownPayslip.attendance.paidDays} of{" "}
                    {ownPayslip.attendance.workingDays} days paid
                    {ownPayslip.attendance.lopDays > 0
                      ? ` · ${ownPayslip.attendance.lopDays} day loss of pay`
                      : ""}
                  </p>
                </div>
                <Button variant="outline" onClick={() => window.print()}>
                  <Download className="mr-2 h-4 w-4" aria-hidden />
                  Download
                </Button>
              </div>

              <div className="grid gap-6 p-4 md:grid-cols-2">
                <div>
                  <p className="eyebrow mb-3">Earnings</p>
                  <dl className="space-y-2">
                    {ownPayslip.earnings.map((line) => (
                      <div key={line.code} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{line.name}</dt>
                        <dd className="tabular font-medium">{formatINR(line.amount)}</dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 border-t pt-2 text-sm font-semibold">
                      <dt>Gross earnings</dt>
                      <dd className="tabular">{formatINR(ownPayslip.grossEarnings)}</dd>
                    </div>
                  </dl>
                </div>

                <div>
                  <p className="eyebrow mb-3">Deductions</p>
                  <dl className="space-y-2">
                    {ownPayslip.deductions.map((line) => (
                      <div key={line.code} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{line.name}</dt>
                        <dd className="tabular font-medium text-danger">
                          {formatINR(line.amount)}
                        </dd>
                      </div>
                    ))}
                    <div className="flex justify-between gap-4 border-t pt-2 text-sm font-semibold">
                      <dt>Total deductions</dt>
                      <dd className="tabular text-danger">
                        {formatINR(ownPayslip.totalDeductions)}
                      </dd>
                    </div>
                  </dl>
                </div>
              </div>

              <div className="border-t bg-primary/5 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="text-sm font-medium">Net pay</span>
                  <span className="tabular text-2xl font-semibold text-info">
                    {formatINR(ownPayslip.netPay)}
                  </span>
                </div>
                <p className="mt-1 text-xs text-subtle-foreground">
                  {ownPayslip.netPayInWords}
                  {ownPayslip.snapshot.bankAccountTail
                    ? ` · Credited to ${ownPayslip.snapshot.bankName ?? "bank"} ••••${ownPayslip.snapshot.bankAccountTail}`
                    : ""}
                </p>
              </div>

              {ownPayslip.employerContributions.length > 0 ? (
                <details className="border-t p-4">
                  <summary className="cursor-pointer text-sm font-medium">
                    Employer contributions
                  </summary>
                  <p className="mt-1 text-xs text-subtle-foreground">
                    Paid by the company on top of your gross. Not deducted from
                    your salary, but part of your cost to company.
                  </p>
                  <dl className="mt-3 space-y-2">
                    {ownPayslip.employerContributions.map((line) => (
                      <div key={line.code} className="flex justify-between gap-4 text-sm">
                        <dt className="text-muted-foreground">{line.name}</dt>
                        <dd className="tabular">{formatINR(line.amount)}</dd>
                      </div>
                    ))}
                  </dl>
                </details>
              ) : null}
            </section>
          ) : null}

          {/* The register, for leads, managers and admins. */}
          {showsRegister ? (
            <section className="space-y-3">
              <SectionHeading
                title="Register"
                description={
                  scope === "org"
                    ? "Every payslip generated for this month."
                    : "Payslips for the people reporting to you."
                }
              />

              <div className="overflow-hidden rounded-lg border bg-surface">
                {payroll.payslips.length === 0 ? (
                  <EmptyState
                    className="border-0"
                    icon={FileText}
                    title="No payslips this month"
                    description="Generation reads attendance for the month, so run it once the month's punches are settled."
                  />
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b text-left">
                          <th className="eyebrow px-4 py-3 font-semibold">Employee</th>
                          <th className="eyebrow hidden px-4 py-3 font-semibold md:table-cell">
                            Days
                          </th>
                          <th className="eyebrow px-4 py-3 text-right font-semibold">
                            Gross
                          </th>
                          <th className="eyebrow hidden px-4 py-3 text-right font-semibold sm:table-cell">
                            Deductions
                          </th>
                          <th className="eyebrow px-4 py-3 text-right font-semibold">Net</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {payroll.payslips.map((row) => (
                          <tr key={row.id} className="transition-colors hover:bg-muted/40">
                            <td className="px-4 py-3">
                              <span className="block font-medium">{row.displayName}</span>
                              <span className="tabular block text-xs text-subtle-foreground">
                                {row.employeeCode}
                                {row.designation ? ` · ${row.designation}` : ""}
                              </span>
                            </td>
                            <td className="tabular hidden px-4 py-3 text-muted-foreground md:table-cell">
                              {row.paidDays}/{row.workingDays}
                              {row.lopDays > 0 ? (
                                <span className="ml-2 text-danger">
                                  {row.lopDays} LOP
                                </span>
                              ) : null}
                            </td>
                            <td className="tabular px-4 py-3 text-right">
                              {formatINR(row.grossEarnings)}
                            </td>
                            <td className="tabular hidden px-4 py-3 text-right text-danger sm:table-cell">
                              {formatINR(row.totalDeductions)}
                            </td>
                            <td className="tabular px-4 py-3 text-right font-semibold">
                              {formatINR(row.netPay)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr className="border-t bg-muted/30 font-semibold">
                          <td className="px-4 py-3">Total</td>
                          <td className="hidden px-4 py-3 md:table-cell" />
                          <td className="tabular px-4 py-3 text-right">
                            {formatINR(payroll.totals.grossEarnings)}
                          </td>
                          <td className="tabular hidden px-4 py-3 text-right text-danger sm:table-cell">
                            {formatINR(payroll.totals.totalDeductions)}
                          </td>
                          <td className="tabular px-4 py-3 text-right">
                            {formatINR(payroll.totals.netPayable)}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                )}
              </div>
            </section>
          ) : null}
        </>
      )}
    </>
  );
}
