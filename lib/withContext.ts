// lib/withContext.ts
//
// Wraps a route handler so that everything inside it runs with request
// context populated: actor, organization, role, employee, client metadata.
//
// This is what makes the Mongoose plugins and the RBAC engine work. A handler
// that is not wrapped runs unscoped and unaudited.
//
//   export const GET = withContext(async (req) => { ... });
//   export const POST = withContext(async (req, { params }) => { ... }, { permission: "employee.create" });
//
// NOTE: this cannot move into Next.js middleware — middleware runs on the
// Edge runtime by default and AsyncLocalStorage requires Node.

import { NextResponse } from "next/server";
import { connect } from "@/lib/mongoose";
import { SESSION_COOKIE, verifyTokenAndSession } from "@/lib/auth";
import { runWithContext, type Role, type RequestContext } from "@/lib/context";
import {
  assertCan,
  assertSuperAdmin,
  ForbiddenError,
  UnauthenticatedError,
} from "@/lib/rbac/guard";
import type { Permission } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity";

type RouteParams = Record<string, string | string[]>;

type RouteHandler<P extends RouteParams> = (
  req: Request,
  ctx: { params: Promise<P> }
) => Promise<Response> | Response;

export interface WithContextOptions {
  /** Permission asserted before the handler runs. */
  permission?: Permission;
  /** Route is platform Super Admin only. */
  superAdminOnly?: boolean;
  /**
   * Route does not need an organization (platform routes, /api/me).
   * Default false — most routes are org-scoped.
   */
  allowNoOrg?: boolean;
}

function bearerToken(req: Request): string | null {
  const header = req.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (!token || scheme.toLowerCase() !== "bearer") return null;
  return token;
}

function cookieToken(req: Request): string | null {
  const raw = req.headers.get("cookie");
  if (!raw) return null;

  for (const part of raw.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE) return decodeURIComponent(rest.join("="));
  }
  return null;
}

/**
 * Bearer header first, then the session cookie.
 *
 * Both are supported because server-rendered navigation carries the cookie
 * while existing client fetches still send the header.
 */
function sessionToken(req: Request): string | null {
  return bearerToken(req) ?? cookieToken(req);
}

function clientIp(req: Request): string | undefined {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim();
  return req.headers.get("x-real-ip") ?? undefined;
}

/**
 * Which organization is this request for?
 *
 * Checked in order:
 *   1. `orgSlug` route param  — once routes move under /[orgSlug]/
 *   2. `x-org-slug` header    — transitional, for the current flat routes
 *   3. `?org=` query param
 *   4. The user's only membership, if they have exactly one
 *
 * Step 4 is what lets the existing flat routes keep working through the
 * migration without any client change, since today every user belongs to a
 * single org.
 */
async function resolveOrg(
  req: Request,
  params: RouteParams,
  userId: string
): Promise<{ orgId: string; role: Role; employeeId: string | null } | null> {
  const { default: Organization } = await import("@/model/Organization");
  const { default: Membership } = await import("@/model/Membership");

  const url = new URL(req.url);
  const slug =
    (typeof params.orgSlug === "string" ? params.orgSlug : undefined) ??
    req.headers.get("x-org-slug") ??
    url.searchParams.get("org") ??
    undefined;

  let orgId: string | undefined;

  if (slug) {
    const org = await Organization.findOne({ slug: slug.toLowerCase() })
      .select("_id status")
      .lean();
    // Unknown slug is a 404 at the route level, not a 403 — don't leak which
    // org slugs exist.
    if (!org) return null;
    if ((org as any).status === "suspended") {
      throw new ForbiddenError("org.suspended", "This organization is suspended.");
    }
    orgId = String((org as any)._id);
  }

  const membershipFilter: Record<string, any> = { userId, status: "active" };
  if (orgId) membershipFilter.orgId = orgId;

  const memberships = await Membership.find(membershipFilter)
    .select("orgId role employeeId")
    .lean();

  if (memberships.length === 0) return null;

  // No slug given and the user belongs to several orgs — ambiguous, make the
  // caller say which one rather than guessing.
  if (!orgId && memberships.length > 1) {
    throw new ForbiddenError(
      "org.ambiguous",
      "Multiple organizations available. Specify one via the x-org-slug header or ?org=."
    );
  }

  const m: any = memberships[0];
  return {
    orgId: String(m.orgId),
    role: m.role as Role,
    employeeId: m.employeeId ? String(m.employeeId) : null,
  };
}

function errorResponse(err: any): Response {
  const status = err?.status ?? (err?.name === "JsonWebTokenError" ? 401 : 500);

  // Anything a caller can act on — 400 validation, 403 permission, 404
  // missing, 409 wrong lifecycle state — carries its message through. These
  // are deliberate, written-for-a-human messages ("Approve the payroll
  // before generating a bank file"), and swallowing them into a generic
  // "Server error" is how a clear refusal becomes a support ticket.
  if (status >= 400 && status < 500) {
    return NextResponse.json({ error: err.message ?? "Request failed" }, { status });
  }

  // Unexpected: log server-side, return something generic. Internal messages
  // can name collections and fields — not for the client.
  console.error("[withContext] unhandled error", err);
  return NextResponse.json({ error: "Server error" }, { status: 500 });
}

export function withContext<P extends RouteParams = RouteParams>(
  handler: RouteHandler<P>,
  options: WithContextOptions = {}
) {
  return async (req: Request, routeCtx?: { params: Promise<P> }): Promise<Response> => {
    try {
      await connect();

      const params = ((routeCtx?.params ? await routeCtx.params : {}) ?? {}) as P;

      const token = sessionToken(req);
      if (!token) throw new UnauthenticatedError("Not signed in");

      const { user } = await verifyTokenAndSession(token);
      const u = user as any;

      if (u.status === "suspended") {
        throw new ForbiddenError("user.suspended", "This account is suspended.");
      }

      const base = {
        userId: String(u._id),
        userName: u.name ?? "Unknown",
        userEmail: u.email ?? "unknown",
        isSuperAdmin: Boolean(u.isSuperAdmin),
        ip: clientIp(req),
        userAgent: req.headers.get("user-agent") ?? undefined,
      };

      let ctx: Omit<RequestContext, "bypassTenantScope" | "suppressActivityLog" | "teamIds">;

      if (u.isSuperAdmin) {
        // Super admin may pin themselves to an org for a drill-down; otherwise
        // they operate at platform level with scoping lifted.
        const url = new URL(req.url);
        const slug =
          (typeof params.orgSlug === "string" ? params.orgSlug : undefined) ??
          req.headers.get("x-org-slug") ??
          url.searchParams.get("org") ??
          undefined;

        let orgId: string | null = null;
        if (slug) {
          const { default: Organization } = await import("@/model/Organization");
          const org = await Organization.findOne({ slug: slug.toLowerCase() })
            .select("_id")
            .lean();
          orgId = org ? String((org as any)._id) : null;
        }

        ctx = { ...base, orgId, role: null, employeeId: null };
      } else {
        const resolved = await resolveOrg(req, params, base.userId);

        if (!resolved) {
          if (options.allowNoOrg) {
            ctx = { ...base, orgId: null, role: null, employeeId: null };
          } else {
            throw new ForbiddenError(
              "org.membership",
              "No active organization membership."
            );
          }
        } else {
          ctx = {
            ...base,
            orgId: resolved.orgId,
            role: resolved.role,
            employeeId: resolved.employeeId,
          };
        }
      }

      return (await runWithContext(ctx, async () => {
        if (options.superAdminOnly) await assertSuperAdmin();
        if (options.permission) await assertCan(options.permission);
        return handler(req, { params: Promise.resolve(params) });
      })) as Response;
    } catch (err: any) {
      return errorResponse(err);
    }
  };
}

/**
 * Wrapper for scheduled jobs. Authenticates with CRON_SECRET rather than a
 * user session, and runs unscoped with logging on.
 */
export function withCronAuth(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    const secret = process.env.CRON_SECRET;
    if (!secret) {
      console.error("[cron] CRON_SECRET is not configured");
      return NextResponse.json({ error: "Not configured" }, { status: 500 });
    }

    const provided = bearerToken(req);
    if (provided !== secret) {
      await logActivity({
        action: "cron.unauthorized",
        entityType: "Cron",
        entityLabel: new URL(req.url).pathname,
        severity: "warning",
      });
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
      await connect();
      return await runWithContext(
        {
          userId: "system",
          userName: "Scheduled Job",
          userEmail: "cron@internal",
          isSuperAdmin: true,
          orgId: null,
          role: null,
          employeeId: null,
          bypassTenantScope: true,
        },
        () => handler(req)
      );
    } catch (err) {
      console.error("[cron] job failed", err);
      return NextResponse.json({ error: "Job failed" }, { status: 500 });
    }
  };
}
