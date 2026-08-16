// lib/session.ts
//
// Server-side session access, for server components and server actions.
//
// Route handlers use withContext (lib/withContext.ts), which reads the same
// cookie. This module is the equivalent for anything that renders on the
// server rather than responding to a fetch.
//
// Usage in a page:
//
//   export default async function Page() {
//     const employees = await withServerContext(() =>
//       Employee.find().lean()
//     );
//     return <EmployeesClient initial={employees} />;
//   }
//
// The data is loaded in-process — no HTTP round trip back into our own API.

import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connect } from "@/lib/mongoose";
import { SESSION_COOKIE, verifyTokenAndSession } from "@/lib/auth";
import { runWithContext, type Role, type RequestContext } from "@/lib/context";

export interface ServerSession {
  user: { id: string; name: string; email: string; isSuperAdmin: boolean };
  role: Role;
  orgId: string | null;
  org: { id: string; name: string; slug: string; logo: string | null } | null;
  employeeId: string | null;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
    photo: string | null;
    designation: string | null;
    department: string | null;
  } | null;
}

/**
 * Resolve the signed-in user, or null when there is no valid session.
 * Does not redirect — callers decide what an anonymous visitor should see.
 */
export async function getServerSession(): Promise<ServerSession | null> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    await connect();
    const { user } = await verifyTokenAndSession(token);
    const u = user as any;

    if (u.status === "suspended") return null;

    const base = {
      user: {
        id: String(u._id),
        name: u.name ?? "Unknown",
        email: u.email ?? "",
        isSuperAdmin: Boolean(u.isSuperAdmin),
      },
    };

    if (u.isSuperAdmin) {
      return {
        ...base,
        role: "SUPER_ADMIN" as Role,
        orgId: null,
        org: null,
        employeeId: null,
        employee: null,
      };
    }

    const { default: Membership } = await import("@/model/Membership");
    const membership: any = await Membership.findOne({
      userId: u._id,
      status: "active",
    })
      .select("orgId role employeeId")
      .lean();

    if (!membership) return null;

    const orgId = String(membership.orgId);
    const employeeId = membership.employeeId ? String(membership.employeeId) : null;

    // Org and employee lookups run inside context so tenant scoping applies.
    const { org, employee } = await runWithContext(
      {
        userId: base.user.id,
        userName: base.user.name,
        userEmail: base.user.email,
        isSuperAdmin: false,
        orgId,
        role: membership.role as Role,
        employeeId,
        suppressActivityLog: true,
      },
      async () => {
        const [{ default: Organization }, { default: Employee }] = await Promise.all([
          import("@/model/Organization"),
          import("@/model/Employee"),
        ]);

        const [orgDoc, empDoc] = await Promise.all([
          Organization.findById(orgId).select("name slug logo").lean(),
          employeeId
            ? Employee.findById(employeeId)
                .select("employeeCode displayName photo designationId departmentId")
                .populate("designationId", "title")
                .populate("departmentId", "name")
                .lean()
            : null,
        ]);

        return { org: orgDoc as any, employee: empDoc as any };
      }
    );

    return {
      ...base,
      role: membership.role as Role,
      orgId,
      org: org
        ? {
            id: String(org._id),
            name: org.name,
            slug: org.slug,
            logo: org.logo ?? null,
          }
        : null,
      employeeId,
      employee: employee
        ? {
            id: String(employee._id),
            employeeCode: employee.employeeCode,
            displayName: employee.displayName,
            photo: employee.photo ?? null,
            designation: employee.designationId?.title ?? null,
            department: employee.departmentId?.name ?? null,
          }
        : null,
    };
  } catch {
    // Expired, tampered, or revoked — treat as signed out.
    return null;
  }
}

/** Session or redirect to sign-in. Use at the top of every protected page. */
export async function requireServerSession(): Promise<ServerSession> {
  const session = await getServerSession();
  if (!session) redirect("/auth/login");
  return session;
}

function contextFrom(
  session: ServerSession,
  ip?: string
): Omit<RequestContext, "bypassTenantScope" | "suppressActivityLog" | "teamIds"> {
  return {
    userId: session.user.id,
    userName: session.user.name,
    userEmail: session.user.email,
    isSuperAdmin: session.user.isSuperAdmin,
    orgId: session.orgId,
    role: session.user.isSuperAdmin ? null : session.role,
    employeeId: session.employeeId,
    ip,
  };
}

/**
 * Run a data-loading function inside the caller's tenant context.
 *
 * Everything the plugins and the RBAC engine need — actor, org, role, team —
 * is in place, so a server component queries models the same way a route
 * handler does.
 */
export async function withServerContext<T>(
  fn: (session: ServerSession) => Promise<T> | T
): Promise<T> {
  const session = await requireServerSession();
  await connect();
  return runWithContext(contextFrom(session), () => fn(session)) as Promise<T>;
}

/** Same, but returns the session alongside the data. */
export async function loadWithSession<T>(
  fn: (session: ServerSession) => Promise<T> | T
): Promise<{ session: ServerSession; data: T }> {
  const session = await requireServerSession();
  await connect();
  const data = (await runWithContext(contextFrom(session), () =>
    fn(session)
  )) as T;
  return { session, data };
}
