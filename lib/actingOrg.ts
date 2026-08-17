// lib/actingOrg.ts
//
// "Admin mode" for the super admin.
//
// A super admin normally runs with `orgId: null`, which lifts tenant scoping
// and lets them read across every organisation. That is right for the platform
// console and wrong for everything else — an unscoped /employees would blend
// every tenant's roster into one list.
//
// Admin mode pins them to a single org by setting `orgId`, so every ordinary
// page behaves exactly as it does for that org's own admin. `isSuperAdmin`
// stays true throughout, so nothing is taken away: they keep platform powers
// (restore, purge, cross-org reads) while acting.
//
// The choice lives in an httpOnly cookie rather than the URL so it survives
// navigation and cannot be flipped by a link someone else sends them.

import { cookies } from "next/headers";

export const ACTING_ORG_COOKIE = "hrms_acting_org";

/** Slug of the org the super admin is currently acting in, if any. */
export async function readActingOrgSlug(): Promise<string | null> {
  const store = await cookies();
  return store.get(ACTING_ORG_COOKIE)?.value?.toLowerCase() ?? null;
}

/** Same, for route handlers, which get the raw request rather than a store. */
export function actingOrgSlugFromRequest(req: Request): string | null {
  const header = req.headers.get("cookie");
  if (!header) return null;

  for (const part of header.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ACTING_ORG_COOKIE) {
      return decodeURIComponent(rest.join("=")).toLowerCase() || null;
    }
  }
  return null;
}

/**
 * Resolve a slug to a live org. Returns null for an unknown, deleted or
 * malformed slug, so a stale cookie degrades to platform mode rather than
 * throwing on every page.
 */
export async function resolveActingOrg(
  slug: string | null,
): Promise<{
  id: string;
  name: string;
  slug: string;
  logo: string | null;
} | null> {
  if (!slug) return null;

  const { default: Organization } = await import("@/model/Organization");
  const org: any = await Organization.findOne({ slug })
    .select("name slug logo")
    .lean();

  if (!org) return null;

  return {
    id: String(org._id),
    name: org.name,
    slug: org.slug,
    logo: org.logo ?? null,
  };
}
