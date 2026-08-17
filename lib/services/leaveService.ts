// lib/services/leaveService.ts
//
// Leave balances, requests, and approvals.
//
// NOTE: Leave and LeaveBalance are legacy collections keyed on userId, not
// employeeId, and carry no tenant plugin — orgId is filtered explicitly.

import mongoose from "mongoose";
import Leave from "@/model/Leave";
import LeaveBalance from "@/model/LeaveBalance";
import Employee from "@/model/Employee";
import { getContext, requireOrgId } from "@/lib/context";
import { assertCan, can, resolveTeamIds, ForbiddenError } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { ValidationError, ConflictError } from "@/lib/services/employee";

export const LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", paid: true },
  { code: "SL", name: "Sick Leave", paid: true },
  { code: "EL", name: "Earned Leave", paid: true },
  { code: "LOP", name: "Unpaid Leave (LOP)", paid: false },
];

/**
 * Working days between two dates, weekends excluded.
 *
 * Counting calendar days would charge someone two days of leave for a Friday
 * to Monday trip that costs the company one.
 */
export function workingDaysBetween(from: Date, to: Date): number {
  let count = 0;
  const cursor = new Date(from);
  cursor.setHours(0, 0, 0, 0);
  const end = new Date(to);
  end.setHours(0, 0, 0, 0);

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) count++;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
}

export async function myLeaveBalances(year = new Date().getFullYear()) {
  const ctx = getContext();
  if (!ctx?.userId) return [];

  const orgId = requireOrgId();
  const rows: any[] = await LeaveBalance.find({ orgId, userId: ctx.userId, year }).lean();
  const byCode = new Map(rows.map((r) => [r.leaveType, r]));

  // Pending days are not yet deducted from `used`, but they are committed —
  // showing a balance that ignores them invites people to over-apply.
  const pending: any[] = await Leave.find({
    orgId,
    userId: ctx.userId,
    status: "Pending",
  }).lean();

  const pendingByType = new Map<string, number>();
  for (const req of pending) {
    const days = workingDaysBetween(new Date(req.fromDate), new Date(req.toDate));
    pendingByType.set(req.leaveType, (pendingByType.get(req.leaveType) ?? 0) + days);
  }

  return LEAVE_TYPES.map((type) => {
    const row = byCode.get(type.code);
    const total = row?.totalCredited ?? 0;
    const used = row?.used ?? 0;
    const pendingDays = pendingByType.get(type.code) ?? 0;

    return {
      code: type.code,
      name: type.name,
      paid: type.paid,
      total,
      used,
      pending: pendingDays,
      available: Math.max(0, total - used - pendingDays),
      /** LOP has no quota — every approved day is loss of pay. */
      uncapped: type.code === "LOP",
    };
  });
}

export async function myLeaveRequests(year = new Date().getFullYear()) {
  const ctx = getContext();
  if (!ctx?.userId) return [];

  const orgId = requireOrgId();
  return Leave.find({
    orgId,
    userId: ctx.userId,
    fromDate: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31) },
  })
    .sort({ fromDate: -1 })
    .lean();
}

/** Requests from the caller's team. Empty for a plain employee. */
export async function teamLeaveRequests(status?: string) {
  const scope = can("leave.read");
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

  const employees: any[] = await Employee.find(employeeFilter)
    .select("displayName employeeCode userId")
    .lean();

  const byUserId = new Map(employees.map((e) => [String(e.userId), e]));
  const ctx = getContext()!;

  const filter: Record<string, any> = {
    orgId,
    userId: { $in: employees.map((e) => e.userId).filter(Boolean) },
  };
  if (status) filter.status = status;

  const rows: any[] = await Leave.find(filter).sort({ appliedAt: -1 }).limit(100).lean();

  return rows
    // Your own request is not yours to approve; it shows under My requests.
    .filter((r) => String(r.userId) !== String(ctx.userId))
    .map((r) => {
      const employee = byUserId.get(String(r.userId));
      return {
        ...r,
        employeeName: employee?.displayName ?? "Unknown",
        employeeCode: employee?.employeeCode ?? "",
        days: workingDaysBetween(new Date(r.fromDate), new Date(r.toDate)),
      };
    });
}

export async function applyForLeave(input: {
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  isHalfDay?: boolean;
}) {
  await assertCan("leave.request");
  const ctx = getContext()!;
  const orgId = requireOrgId();

  const from = new Date(input.fromDate);
  const to = new Date(input.toDate);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ValidationError("Pick valid dates.");
  }
  if (to < from) throw new ValidationError("The end date is before the start date.");
  if (!input.reason?.trim()) throw new ValidationError("Add a reason.");

  const days = input.isHalfDay ? 0.5 : workingDaysBetween(from, to);
  if (days === 0) {
    throw new ValidationError(
      "That range is entirely weekend — there is nothing to apply for."
    );
  }

  // Overlap check. Without it the same days can be booked twice and the
  // balance goes negative on approval.
  const clash = await Leave.findOne({
    orgId,
    userId: ctx.userId,
    status: { $in: ["Pending", "Approved"] },
    fromDate: { $lte: to },
    toDate: { $gte: from },
  }).lean();

  if (clash) {
    throw new ConflictError("You already have leave applied for overlapping dates.");
  }

  if (input.leaveType !== "LOP") {
    const balances = await myLeaveBalances(from.getFullYear());
    const balance = balances.find((b) => b.code === input.leaveType);
    if (balance && days > balance.available) {
      throw new ConflictError(
        `Only ${balance.available} day(s) of ${balance.name} left. Apply for unpaid leave instead if you need more.`
      );
    }
  }

  const employee: any = await Employee.findById(ctx.employeeId).select("reportsTo").lean();
  let approverUserId: any = null;
  if (employee?.reportsTo) {
    const manager: any = await Employee.findById(employee.reportsTo).select("userId").lean();
    approverUserId = manager?.userId ?? null;
  }

  // Constructed then saved rather than Model.create(): passing an object
  // cast to `any` makes TypeScript pick create()'s array overload, so the
  // result comes back typed as a list.
  const leave = new Leave({
    orgId,
    userId: ctx.userId,
    leaveType: input.leaveType,
    fromDate: from,
    toDate: to,
    isHalfDay: Boolean(input.isHalfDay),
    reason: input.reason.trim(),
    status: "Pending",
    approverId: approverUserId,
    appliedAt: new Date(),
  } as any);
  await leave.save();

  await logActivity({
    action: "leave.applied",
    entityType: "Leave",
    entityId: leave._id,
    entityLabel: `${input.leaveType} · ${days} day(s)`,
    metadata: { from: input.fromDate, to: input.toDate, days },
  });

  return { leave, days };
}

export async function reviewLeave(
  leaveId: string,
  decision: "Approved" | "Rejected",
  remarks?: string
) {
  await assertCan("leave.approve");
  const ctx = getContext()!;
  const orgId = requireOrgId();

  if (!mongoose.Types.ObjectId.isValid(leaveId)) {
    throw new ValidationError("That is not a valid request id.");
  }

  const leave: any = await Leave.findOne({ _id: leaveId, orgId });
  if (!leave) throw new ValidationError("Request not found.");
  if (leave.status !== "Pending") {
    throw new ConflictError(`This request was already ${leave.status.toLowerCase()}.`);
  }
  if (String(leave.userId) === String(ctx.userId)) {
    throw new ForbiddenError("leave.approve", "You cannot approve your own leave.");
  }

  if (decision === "Rejected" && !remarks?.trim()) {
    throw new ValidationError("Say why, so the person knows where they stand.");
  }

  leave.status = decision;
  leave.approverId = ctx.userId;
  leave.approverRemarks = remarks?.trim();
  leave.reviewedAt = new Date();
  await leave.save();

  // Balance moves only on approval. Deducting at apply time would strand
  // days whenever a request is rejected or withdrawn.
  if (decision === "Approved" && leave.leaveType !== "LOP") {
    const days = leave.isHalfDay
      ? 0.5
      : workingDaysBetween(new Date(leave.fromDate), new Date(leave.toDate));

    await LeaveBalance.findOneAndUpdate(
      {
        orgId,
        userId: leave.userId,
        leaveType: leave.leaveType,
        year: new Date(leave.fromDate).getFullYear(),
      },
      { $inc: { used: days, balance: -days }, $set: { lastUpdated: new Date() } }
    );
  }

  await logActivity({
    action: `leave.${decision.toLowerCase()}`,
    entityType: "Leave",
    entityId: leave._id,
    entityLabel: `${leave.leaveType} · ${decision}`,
    metadata: { remarks },
    severity: "warning",
  });

  return leave;
}

/** Withdraw your own pending request. */
export async function cancelLeave(leaveId: string) {
  const ctx = getContext()!;
  const orgId = requireOrgId();

  const leave: any = await Leave.findOne({ _id: leaveId, orgId, userId: ctx.userId });
  if (!leave) throw new ValidationError("Request not found.");
  if (leave.status !== "Pending") {
    throw new ConflictError(`This request was already ${leave.status.toLowerCase()}.`);
  }

  await Leave.deleteOne({ _id: leaveId });
  return true;
}
