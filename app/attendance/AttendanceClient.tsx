"use client";

import { Fragment, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  CalendarDays,
  CalendarCheck,
  Clock,
  LayoutGrid,
  List,
  LogIn,
  LogOut,
  PieChart,
  Timer,
  TrendingUp,
  UserMinus,
  ChevronDown,
} from "lucide-react";

import AttendanceCalendar from "@/components/AttendanceCalendar";
import { PageHeader, SectionHeading } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatusPill, ATTENDANCE_TONE } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDuration, monthLabel, monthLabelShort } from "@/lib/format";

interface DayRecord {
  _id: string;
  date: string;
  status: string;
  totalHours: number;
  punches: { type: string; time: string }[];
  firstIn: string | null;
  lastOut: string | null;
  isLate: boolean;
}

function clockTime(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleTimeString("en-IN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
  });
}

function dayLabel(date: string) {
  return new Date(date).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
  });
}

function isWeekend(date: string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}

export function AttendanceClient({
  today,
  summary,
  records,
  team,
  seesTeam,
  month,
  months,
  teamDate,
}: {
  today: any;
  summary: any;
  records: DayRecord[];
  team: { members: any[]; markedIn: number };
  seesTeam: boolean;
  month: string;
  months: string[];
  teamDate: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"calendar" | "log">("calendar");
  const [expanded, setExpanded] = useState<string | null>(null);

  const byDate = new Map(records.map((r) => [r.date, r]));

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

  function go(next: Record<string, string>) {
    const params = new URLSearchParams({ month, date: teamDate, ...next });
    startTransition(() => router.push(`/attendance?${params}`));
  }

  return (
    <>
      <PageHeader
        title="Attendance"
        description="Punch in and out, and review every session you have logged."
        actions={
          <select
            value={month}
            onChange={(e) => go({ month: e.target.value })}
            aria-label="Month"
            className="h-9 rounded-md border bg-surface px-3 text-sm"
          >
            {months.map((m) => (
              <option key={m} value={m}>
                {monthLabelShort(m)}
              </option>
            ))}
          </select>
        }
      />

      {/* Today */}
      <section className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        <div className="rounded-lg border bg-surface p-5">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-medium">{dayLabel(today.date)}</span>
            <StatusPill tone={ATTENDANCE_TONE[today.status] ?? "neutral"}>
              {today.status}
            </StatusPill>
          </div>

          <p className="tabular mt-3 text-4xl font-semibold tracking-tight">
            {formatDuration(today.totalHours)}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">Total time logged today</p>

          <Button className="mt-4" onClick={punch} disabled={busy}>
            {today.isCheckedIn ? (
              <>
                <LogOut className="mr-2 h-4 w-4" aria-hidden /> Check out
              </>
            ) : (
              <>
                <LogIn className="mr-2 h-4 w-4" aria-hidden /> Check in
              </>
            )}
          </Button>
        </div>

        <div className="rounded-lg border bg-surface p-5">
          <h2 className="text-sm font-semibold">Today&rsquo;s sessions</h2>
          {today.punches.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              No punches on {dayLabel(today.date)} yet.
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {today.punches.map((p: any, i: number) => (
                <li key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {p.type === "IN" ? "Checked in" : "Checked out"}
                  </span>
                  <span className="tabular font-medium">{clockTime(p.time)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Month summary */}
      <StatGrid>
        <StatCard icon={CalendarDays} label="Working days" value={summary.workingDays}
          sublabel="Weekdays so far this month" />
        <StatCard icon={CalendarCheck} label="Present" value={summary.present} tone="success"
          sublabel={summary.wfh > 0 ? `${summary.wfh} from home` : "Full days marked"} />
        <StatCard icon={PieChart} label="Half days" value={summary.halfDays}
          tone={summary.halfDays > 0 ? "warning" : "default"} sublabel="Under six hours logged" />
        <StatCard icon={UserMinus} label="Absent" value={summary.absent}
          tone={summary.absent > 0 ? "danger" : "default"} sublabel="No punches recorded" />
        <StatCard icon={Clock} label="Total hours" value={formatDuration(summary.totalHours)}
          sublabel="Across every session" />
        <StatCard icon={Timer} label="Late days" value={summary.lateDays}
          tone={summary.lateDays > 0 ? "warning" : "default"} sublabel="Arrived after 10:15" />
        <StatCard icon={TrendingUp} label="Overtime" value={formatDuration(summary.overtimeHours)}
          sublabel="Beyond eight hours a day" />
      </StatGrid>

      {/* My month — two views of the same data */}
      <section className="space-y-3">
        <SectionHeading
          title={`My attendance · ${monthLabel(month)}`}
          actions={
            <div className="flex rounded-md border p-0.5">
              <button
                onClick={() => setView("calendar")}
                aria-pressed={view === "calendar"}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-sm transition-colors ${
                  view === "calendar"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" aria-hidden /> Calendar
              </button>
              <button
                onClick={() => setView("log")}
                aria-pressed={view === "log"}
                className={`flex items-center gap-1.5 rounded px-2.5 py-1 text-sm transition-colors ${
                  view === "log"
                    ? "bg-primary/10 font-medium text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <List className="h-3.5 w-3.5" aria-hidden /> Log
              </button>
            </div>
          }
        />

        {view === "calendar" ? (
          <div className="rounded-lg border bg-surface p-4">
            <AttendanceCalendar attendance={records as any} month={month} />
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg border bg-surface">
            {records.length === 0 ? (
              <EmptyState
                className="border-0"
                icon={CalendarDays}
                title={`Nothing logged in ${monthLabel(month)}`}
                description="Days appear here once you punch in. Weekends and holidays are shown but not counted against you."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="eyebrow px-4 py-3 font-semibold">Date</th>
                      <th className="eyebrow px-4 py-3 font-semibold">In</th>
                      <th className="eyebrow px-4 py-3 font-semibold">Out</th>
                      <th className="eyebrow px-4 py-3 font-semibold">Hours</th>
                      <th className="eyebrow px-4 py-3 font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {records.map((r) => {
                      const open = expanded === r.date;
                      return (
                        // A keyless <> fragment as a list item drops the key
                        // and React warns; the row pair needs one wrapper key.
                        <Fragment key={r.date}>
                          <tr
                            onClick={() => setExpanded(open ? null : r.date)}
                            className="cursor-pointer transition-colors hover:bg-muted/40"
                          >
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-1.5">
                                <ChevronDown
                                  className={`h-3.5 w-3.5 text-subtle-foreground transition-transform ${
                                    open ? "rotate-180" : ""
                                  }`}
                                  aria-hidden
                                />
                                {dayLabel(r.date)}
                              </span>
                            </td>
                            <td className="tabular px-4 py-3 text-muted-foreground">
                              {clockTime(r.firstIn)}
                            </td>
                            <td className="tabular px-4 py-3 text-muted-foreground">
                              {clockTime(r.lastOut)}
                            </td>
                            <td className="tabular px-4 py-3">
                              {formatDuration(r.totalHours)}
                            </td>
                            <td className="px-4 py-3">
                              <span className="flex flex-wrap items-center gap-1.5">
                                <StatusPill
                                  tone={
                                    isWeekend(r.date)
                                      ? "neutral"
                                      : ATTENDANCE_TONE[r.status] ?? "neutral"
                                  }
                                >
                                  {isWeekend(r.date) ? "Weekend" : r.status}
                                </StatusPill>
                                {r.isLate ? (
                                  <StatusPill tone="warning" dot={false}>
                                    Late
                                  </StatusPill>
                                ) : null}
                              </span>
                            </td>
                          </tr>

                          {open ? (
                            <tr className="bg-muted/20">
                              <td colSpan={5} className="px-4 py-3">
                                {r.punches.length === 0 ? (
                                  <p className="text-xs text-subtle-foreground">
                                    No punches recorded on this day.
                                  </p>
                                ) : (
                                  <ol className="space-y-1.5">
                                    {r.punches.map((p, i) => (
                                      <li
                                        key={i}
                                        className="flex items-center gap-3 text-xs"
                                      >
                                        <span className="w-20 text-subtle-foreground">
                                          {p.type === "IN" ? "Checked in" : "Checked out"}
                                        </span>
                                        <span className="tabular font-medium">
                                          {clockTime(p.time)}
                                        </span>
                                      </li>
                                    ))}
                                  </ol>
                                )}
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Team, by date */}
      {seesTeam ? (
        <section className="space-y-3">
          <SectionHeading
            title="Team"
            description={`${team.markedIn} of ${team.members.length} marked in`}
            actions={
              <input
                type="date"
                value={teamDate}
                onChange={(e) => go({ date: e.target.value })}
                aria-label="Team date"
                className="h-9 rounded-md border bg-surface px-3 text-sm"
              />
            }
          />

          <div className="overflow-hidden rounded-lg border bg-surface">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left">
                    <th className="eyebrow px-4 py-3 font-semibold">Employee</th>
                    <th className="eyebrow hidden px-4 py-3 font-semibold sm:table-cell">
                      Code
                    </th>
                    <th className="eyebrow px-4 py-3 font-semibold">In</th>
                    <th className="eyebrow px-4 py-3 font-semibold">Out</th>
                    <th className="eyebrow hidden px-4 py-3 font-semibold md:table-cell">
                      Hours
                    </th>
                    <th className="eyebrow px-4 py-3 font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {team.members.map((m) => (
                    <tr key={m.employeeId} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3 font-medium">{m.displayName}</td>
                      <td className="tabular hidden px-4 py-3 text-subtle-foreground sm:table-cell">
                        {m.employeeCode}
                      </td>
                      <td className="tabular px-4 py-3 text-muted-foreground">
                        {clockTime(m.firstIn)}
                      </td>
                      <td className="tabular px-4 py-3 text-muted-foreground">
                        {clockTime(m.lastOut)}
                      </td>
                      <td className="tabular hidden px-4 py-3 md:table-cell">
                        {m.totalHours ? formatDuration(m.totalHours) : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={ATTENDANCE_TONE[m.status] ?? "neutral"}>
                          {m.status}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
