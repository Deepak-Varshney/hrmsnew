// lib/services/attendanceQueries.ts
//
// Attendance reads for the dashboard and the attendance page.
//
// NOTE: Attendance is a legacy collection keyed on userId, not employeeId,
// and it does not carry the tenant plugin yet. orgId is therefore filtered
// explicitly here. When the model is migrated to tenantModel these filters
// become redundant but harmless.

import mongoose from "mongoose";
import Attendance from "@/model/Attendance";
import Employee from "@/model/Employee";
import { getContext, requireOrgId } from "@/lib/context";
import { can, resolveTeamIds } from "@/lib/rbac";

/** Arrivals after this are counted late. Should become an org setting. */
export const LATE_THRESHOLD_MINUTES = 10 * 60 + 15; // 10:15
const FULL_DAY_HOURS = 8;

export function todayKey(): string {
  return new Date().toISOString().split("T")[0];
}

export function monthKeyOf(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

/** Weekdays in a month, counting only up to today for the current month. */
export function workingDaysIn(month: string): number {
  const [year, m] = month.split("-").map(Number);
  const lastOfMonth = new Date(year, m, 0).getDate();
  const today = new Date();
  const isCurrentMonth = today.getFullYear() === year && today.getMonth() === m - 1;
  const upTo = isCurrentMonth ? today.getDate() : lastOfMonth;

  let count = 0;
  for (let day = 1; day <= upTo; day++) {
    const weekday = new Date(year, m - 1, day).getDay();
    if (weekday !== 0 && weekday !== 6) count++;
  }
  return count;
}

function firstInMinutes(punches: any[]): number | null {
  const firstIn = punches?.find((p) => p.type === "IN");
  if (!firstIn) return null;
  const time = new Date(firstIn.time);
  return time.getHours() * 60 + time.getMinutes();
}

export interface TodayAttendance {
  date: string;
  status: string;
  punches: { type: string; time: string }[];
  firstIn: string | null;
  lastOut: string | null;
  sessions: number;
  totalHours: number;
  isCheckedIn: boolean;
}

/** The signed-in person's record for today, for the check-in card. */
export async function myToday(): Promise<TodayAttendance> {
  const ctx = getContext();
  const date = todayKey();

  const empty: TodayAttendance = {
    date,
    status: "Not marked",
    punches: [],
    firstIn: null,
    lastOut: null,
    sessions: 0,
    totalHours: 0,
    isCheckedIn: false,
  };

  if (!ctx?.userId || ctx.userId === "system") return empty;

  const row: any = await Attendance.findOne({ userId: ctx.userId, date }).lean();
  if (!row) return empty;

  const punches = (row.punches ?? []).map((p: any) => ({
    type: p.type,
    time: new Date(p.time).toISOString(),
  }));

  const ins = punches.filter((p: any) => p.type === "IN");
  const outs = punches.filter((p: any) => p.type === "OUT");
  const last = punches[punches.length - 1];

  return {
    date,
    status: row.status ?? "Not marked",
    punches,
    firstIn: ins[0]?.time ?? null,
    lastOut: outs[outs.length - 1]?.time ?? null,
    sessions: ins.length,
    totalHours: row.totalHours ?? 0,
    // An open IN with no matching OUT means the clock is still running.
    isCheckedIn: last?.type === "IN",
  };
}

export interface MonthSummary {
  month: string;
  workingDays: number;
  present: number;
  halfDays: number;
  absent: number;
  wfh: number;
  totalHours: number;
  lateDays: number;
  overtimeHours: number;
}

export async function myMonthSummary(month = monthKeyOf()): Promise<MonthSummary> {
  const ctx = getContext();
  const workingDays = workingDaysIn(month);

  const base: MonthSummary = {
    month,
    workingDays,
    present: 0,
    halfDays: 0,
    absent: 0,
    wfh: 0,
    totalHours: 0,
    lateDays: 0,
    overtimeHours: 0,
  };

  if (!ctx?.userId || ctx.userId === "system") return base;

  const rows: any[] = await Attendance.find({
    userId: ctx.userId,
    date: { $regex: `^${month}` },
  }).lean();

  for (const row of rows) {
    const hours = row.totalHours ?? 0;
    base.totalHours += hours;

    if (row.status === "Absent") {
      base.absent += 1;
      continue;
    }
    if (row.status === "WFH") base.wfh += 1;

    // Under six hours is treated as a half day. Should become an org setting
    // alongside the late threshold.
    if (hours > 0 && hours < 6) base.halfDays += 1;
    else base.present += 1;

    const inMinutes = firstInMinutes(row.punches);
    if (inMinutes !== null && inMinutes > LATE_THRESHOLD_MINUTES) base.lateDays += 1;

    if (hours > FULL_DAY_HOURS) base.overtimeHours += hours - FULL_DAY_HOURS;
  }

  base.totalHours = Number(base.totalHours.toFixed(2));
  base.overtimeHours = Number(base.overtimeHours.toFixed(2));
  return base;
}

export interface TeamMemberToday {
  employeeId: string;
  displayName: string;
  employeeCode: string;
  status: string;
  firstIn: string | null;
  lastOut: string | null;
  totalHours: number;
}

/** Who on the team has marked in today. Empty for an employee. */
export async function teamToday(): Promise<{
  members: TeamMemberToday[];
  markedIn: number;
}> {
  const scope = can("attendance.read");
  if (scope !== "team" && scope !== "org") return { members: [], markedIn: 0 };

  const orgId = requireOrgId();
  const ctx = getContext()!;

  const employeeFilter: Record<string, any> =
    scope === "team"
      ? {
          _id: {
            $in: (await resolveTeamIds()).map((id) => new mongoose.Types.ObjectId(id)),
          },
        }
      : {};

  const employees: any[] = await Employee.find({
    ...employeeFilter,
    "employment.status": { $ne: "exited" },
  })
    .select("displayName employeeCode userId")
    .sort({ displayName: 1 })
    .lean();

  const userIds = employees.map((e) => e.userId).filter(Boolean);
  const date = todayKey();

  const rows: any[] = await Attendance.find({
    orgId,
    userId: { $in: userIds },
    date,
  }).lean();

  const byUser = new Map(rows.map((r) => [String(r.userId), r]));

  const members: TeamMemberToday[] = employees.map((e) => {
    const row = byUser.get(String(e.userId));
    const punches = row?.punches ?? [];
    const ins = punches.filter((p: any) => p.type === "IN");
    const outs = punches.filter((p: any) => p.type === "OUT");

    return {
      employeeId: String(e._id),
      displayName: e.displayName,
      employeeCode: e.employeeCode,
      status: row?.status ?? "Not marked",
      firstIn: ins[0] ? new Date(ins[0].time).toISOString() : null,
      lastOut: outs.length ? new Date(outs[outs.length - 1].time).toISOString() : null,
      totalHours: row?.totalHours ?? 0,
    };
  });

  return {
    members,
    markedIn: members.filter((m) => m.status !== "Not marked").length,
  };
}

export interface AttendanceFlag {
  employeeId: string;
  displayName: string;
  employeeCode: string;
  lateDays: number;
  absentDays: number;
}

/**
 * People who crossed the late or absence threshold this month — the list a
 * lead actually needs to follow up on, rather than the whole roster.
 */
export async function attendanceFlags(
  month = monthKeyOf(),
  lateLimit = 3,
  absentLimit = 2
): Promise<AttendanceFlag[]> {
  const scope = can("attendance.read");
  if (scope !== "team" && scope !== "org") return [];

  const orgId = requireOrgId();

  const employeeFilter: Record<string, any> =
    scope === "team"
      ? {
          _id: {
            $in: (await resolveTeamIds()).map((id) => new mongoose.Types.ObjectId(id)),
          },
        }
      : {};

  const employees: any[] = await Employee.find({
    ...employeeFilter,
    "employment.status": { $ne: "exited" },
  })
    .select("displayName employeeCode userId")
    .lean();

  const byUserId = new Map(employees.map((e) => [String(e.userId), e]));

  const rows: any[] = await Attendance.find({
    orgId,
    userId: { $in: employees.map((e) => e.userId).filter(Boolean) },
    date: { $regex: `^${month}` },
  }).lean();

  const tally = new Map<string, { late: number; absent: number }>();
  for (const row of rows) {
    const key = String(row.userId);
    const entry = tally.get(key) ?? { late: 0, absent: 0 };

    if (row.status === "Absent") entry.absent += 1;
    else {
      const inMinutes = firstInMinutes(row.punches);
      if (inMinutes !== null && inMinutes > LATE_THRESHOLD_MINUTES) entry.late += 1;
    }
    tally.set(key, entry);
  }

  const flags: AttendanceFlag[] = [];
  for (const [userId, counts] of tally) {
    if (counts.late < lateLimit && counts.absent < absentLimit) continue;
    const employee = byUserId.get(userId);
    if (!employee) continue;

    flags.push({
      employeeId: String(employee._id),
      displayName: employee.displayName,
      employeeCode: employee.employeeCode,
      lateDays: counts.late,
      absentDays: counts.absent,
    });
  }

  return flags.sort((a, b) => b.absentDays - a.absentDays || b.lateDays - a.lateDays);
}
