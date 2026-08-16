// app/api/me/route.ts
//
// Everything the app shell needs in one call: who you are, which org you are
// in, what you can do there, and the counts that drive nav badges.
//
// Role comes from Membership, not User — the legacy User.role field is not
// authoritative any more.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { getContext } from "@/lib/context";
import Organization from "@/model/Organization";
import Employee from "@/model/Employee";

export const GET = withContext(
  async () => {
    const ctx = getContext()!;

    const [org, employee] = await Promise.all([
      ctx.orgId
        ? Organization.findById(ctx.orgId).select("name slug logo timezone").lean()
        : null,
      ctx.employeeId
        ? Employee.findById(ctx.employeeId)
            .select("employeeCode displayName photo designationId departmentId")
            .populate("designationId", "title")
            .populate("departmentId", "name")
            .lean()
        : null,
    ]);

    return NextResponse.json({
      user: {
        id: ctx.userId,
        name: ctx.userName,
        email: ctx.userEmail,
        isSuperAdmin: ctx.isSuperAdmin,
      },
      // Super admin holds no membership, so surface the platform role directly.
      role: ctx.isSuperAdmin ? "SUPER_ADMIN" : ctx.role,
      org: org
        ? {
            id: String((org as any)._id),
            name: (org as any).name,
            slug: (org as any).slug,
            logo: (org as any).logo ?? null,
            timezone: (org as any).timezone,
          }
        : null,
      employee: employee
        ? {
            id: String((employee as any)._id),
            employeeCode: (employee as any).employeeCode,
            displayName: (employee as any).displayName,
            photo: (employee as any).photo ?? null,
            designation: (employee as any).designationId?.title ?? null,
            department: (employee as any).departmentId?.name ?? null,
          }
        : null,
      badges: {
        announcements: 0,
        approvals: 0,
      },
    });
  },
  // Super admin is not a member of any org, so this route must not insist on one.
  { allowNoOrg: true }
);
