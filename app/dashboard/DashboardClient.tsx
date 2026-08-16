"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarCheck,
  CalendarDays,
  Clock,
  LogIn,
  LogOut,
  PieChart,
  Timer,
  TrendingDown,
  TrendingUp,
  Users,
  UserCheck,
  UserMinus,
  Building2,
  Wallet,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatusPill, ATTENDANCE_TONE } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatINR, formatDuration, monthLabel } from "@/lib/format";

interface Today {
  date: string;
  status: string;
  firstIn: string | null;
  lastOut: string | null;
  sessions: number;
  totalHours: number;
  isCheckedIn: boolean;
}

interface Summary {
  workingDays: number;
  present: number;
  halfDays: number;
  absent: number;
  wfh: number;
  totalHours: number;
  lateDays: number;
  overtimeHours: number;
}

interface TeamMember {
  employeeId: string;
  displayName: string;
  employeeCode: string;
  status: string;
  firstIn: string | null;
}

interface Flag {
  employeeId: string;
  displayName: string;
  employeeCode: string;
  lateDays: number;
  absentDays: number;
}

function clockTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

/** hh:mm:ss from a fractional hours value. */
function hms(hours: number): string {
  const total = Math.max(0, Math.floor(hours * 3600));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return [h, m, s].map((n) => String(n).padStart(2, "0")).join(":");
}

export function DashboardClient({
  firstName,
  month,
  today,
  summary,
  team,
  flags,
  headcount,
  payroll,
}: {
  firstName: string;
  fullName: string;
  month: string;
  today: Today;
  summary: Summary;
  team: { members: TeamMember[]; markedIn: number };
  flags: Flag[];
  headcount: any | null;
  payroll: any | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  // While the clock is running, the elapsed figure has to keep moving —
  // a frozen 00:00:00 next to a "Check out" button reads as broken.
  const [elapsed, setElapsed] = useState(today.totalHours);

  useEffect(() => {
    setElapsed(today.totalHours);
    if (!today.isCheckedIn || !today.firstIn) return;

    const openedAt = new Date(today.firstIn).getTime();
    const completed = today.totalHours;

    const tick = () => {
      const openHours = (Date.now() - openedAt) / 3_600_000;
      setElapsed(completed + Math.max(0, openHours));
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [today.isCheckedIn, today.firstIn, today.totalHours]);

  async function punch() {
    setBusy(true);
    try {
      const res = await fetch("/api/attendance/punch", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not record that");

      toast.success(body.type === "IN" ? "Checked in" : "Checked out");
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  const dateLabel = new Date(today.date).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <>
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={`Your ${monthLabel(month)} at a glance.`}
      />

      {/* Today — the one thing most people open this page to do. */}
      <section className="rounded-lg border bg-surface p-5">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium">{dateLabel}</span>
          <StatusPill tone={ATTENDANCE_TONE[today.status] ?? "neutral"}>
            {today.status}
          </StatusPill>
        </div>

        <p className="tabular mt-4 text-5xl font-semibold tracking-tight sm:text-6xl">
          {hms(elapsed)}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">Total time logged today</p>

        <dl className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
          <div>
            <dt className="eyebrow">First in</dt>
            <dd className="tabular mt-1 text-sm font-medium">{clockTime(today.firstIn)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Last out</dt>
            <dd className="tabular mt-1 text-sm font-medium">{clockTime(today.lastOut)}</dd>
          </div>
          <div>
            <dt className="eyebrow">Sessions</dt>
            <dd className="tabular mt-1 text-sm font-medium">{today.sessions}</dd>
          </div>
        </dl>

        <Button
          className="mt-5 w-full sm:w-auto"
          size="lg"
          onClick={punch}
          disabled={busy || pending}
        >
          {today.isCheckedIn ? (
            <>
              <LogOut className="mr-2 h-4 w-4" aria-hidden />
              Check out
            </>
          ) : (
            <>
              <LogIn className="mr-2 h-4 w-4" aria-hidden />
              Check in
            </>
          )}
        </Button>
      </section>

      {/* This month */}
      <section className="space-y-3">
        <SectionHeading title={monthLabel(month)} />
        <StatGrid>
          <StatCard
            icon={CalendarDays}
            label="Working days"
            value={summary.workingDays}
            sublabel="Weekdays so far this month"
          />
          <StatCard
            icon={CalendarCheck}
            label="Present"
            value={summary.present}
            tone="success"
            sublabel={summary.wfh > 0 ? `${summary.wfh} of them from home` : "Full days marked"}
          />
          <StatCard
            icon={PieChart}
            label="Half days"
            value={summary.halfDays}
            tone={summary.halfDays > 0 ? "warning" : "default"}
            sublabel="Under six hours logged"
          />
          <StatCard
            icon={UserMinus}
            label="Absent"
            value={summary.absent}
            tone={summary.absent > 0 ? "danger" : "default"}
            sublabel="No punches recorded"
          />
          <StatCard
            icon={Clock}
            label="Total hours"
            value={formatDuration(summary.totalHours)}
            sublabel="Across every session this month"
          />
          <StatCard
            icon={Timer}
            label="Late days"
            value={summary.lateDays}
            tone={summary.lateDays > 0 ? "warning" : "default"}
            sublabel="Arrived after 10:15"
          />
          <StatCard
            icon={TrendingUp}
            label="Overtime"
            value={formatDuration(summary.overtimeHours)}
            sublabel="Logged beyond eight hours a day"
          />
        </StatGrid>
      </section>

      {/* Headcount — leadership only */}
      {headcount ? (
        <section className="space-y-3">
          <SectionHeading title="Headcount" />
          <StatGrid>
            <StatCard
              icon={Users}
              label="On roll"
              value={headcount.onRoll}
              sublabel={
                headcount.departed > 0
                  ? `${headcount.total} on record · ${headcount.departed} departed`
                  : "Everyone currently employed"
              }
            />
            <StatCard
              icon={UserCheck}
              label="Active"
              value={headcount.active}
              tone="success"
              sublabel={
                headcount.probation > 0
                  ? `${headcount.probation} still on probation`
                  : "Confirmed and working"
              }
            />
            <StatCard
              icon={UserMinus}
              label="Away"
              value={headcount.onLeave + headcount.noticePeriod}
              sublabel="On leave or serving notice, still on the roll"
            />
            {headcount.largestTeam ? (
              <StatCard
                icon={Building2}
                label="Largest team"
                value={<span className="text-2xl">{headcount.largestTeam.name}</span>}
                sublabel={`${headcount.largestTeam.count} people`}
              />
            ) : null}
          </StatGrid>
        </section>
      ) : null}

      {/* Payroll — leadership only */}
      {payroll ? (
        <section className="space-y-3">
          <SectionHeading
            title={`Payroll · ${monthLabel(payroll.month)}`}
            actions={
              <Link
                href={`/payroll?month=${payroll.month}`}
                className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
              >
                Open register
                <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </Link>
            }
          />
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
              label="Payslips"
              value={payroll.totals.payslipCount}
              sublabel="Generated for this month"
            />
          </StatGrid>
        </section>
      ) : null}

      {/* Team today — leadership only */}
      {team.members.length > 0 ? (
        <section className="rounded-lg border bg-surface">
          <div className="border-b p-4">
            <h2 className="text-base font-semibold">Team today</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {team.markedIn} of {team.members.length} marked in
            </p>
          </div>

          <ul className="divide-y">
            {team.members.slice(0, 8).map((member) => (
              <li
                key={member.employeeId}
                className="flex items-center justify-between gap-3 p-4"
              >
                <div className="min-w-0">
                  <Link
                    href={`/employees/${member.employeeId}`}
                    className="block truncate font-medium hover:underline"
                  >
                    {member.displayName}
                  </Link>
                  <span className="text-xs text-subtle-foreground">
                    {member.firstIn ? `In at ${clockTime(member.firstIn)}` : "Not marked"}
                  </span>
                </div>
                <StatusPill tone={ATTENDANCE_TONE[member.status] ?? "neutral"}>
                  {member.status}
                </StatusPill>
              </li>
            ))}
          </ul>

          <div className="border-t p-4">
            <Link
              href="/attendance"
              className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
            >
              View full day
              <ArrowRight className="h-3.5 w-3.5" aria-hidden />
            </Link>
          </div>
        </section>
      ) : null}

      {/* Attendance flags — leadership only */}
      {team.members.length > 0 ? (
        <section className="space-y-3">
          <SectionHeading
            title="Attendance flags"
            description={
              flags.length === 0
                ? `Nobody crossed the late or absence thresholds in ${monthLabel(month)}.`
                : `${flags.length} ${flags.length === 1 ? "person" : "people"} to follow up on.`
            }
          />

          {flags.length === 0 ? (
            <EmptyState
              icon={ShieldCheck}
              title="No flags this month"
              description="Flags appear here once someone passes three late arrivals or two absences, so there is nothing to follow up on right now."
            />
          ) : (
            <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
              {flags.map((flag) => (
                <li
                  key={flag.employeeId}
                  className="flex items-center justify-between gap-3 p-4"
                >
                  <div className="min-w-0">
                    <Link
                      href={`/employees/${flag.employeeId}`}
                      className="block truncate font-medium hover:underline"
                    >
                      {flag.displayName}
                    </Link>
                    <span className="tabular text-xs text-subtle-foreground">
                      {flag.employeeCode}
                    </span>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {flag.lateDays > 0 ? (
                      <StatusPill tone="warning">{flag.lateDays} late</StatusPill>
                    ) : null}
                    {flag.absentDays > 0 ? (
                      <StatusPill tone="danger">{flag.absentDays} absent</StatusPill>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
