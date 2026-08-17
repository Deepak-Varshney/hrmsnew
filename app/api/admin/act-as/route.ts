// app/api/admin/act-as/route.ts
//
// Enter and leave admin mode. Super admin only.
//
// Entering and leaving are both logged as critical: "the super admin was
// operating inside Acme" is exactly the kind of thing an audit needs to be
// able to reconstruct later.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { ACTING_ORG_COOKIE } from "@/lib/actingOrg";
import { logActivity } from "@/lib/activity";
import { ValidationError } from "@/lib/services/employee";
import Organization from "@/model/Organization";

const COOKIE_BASE = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

export const POST = withContext(
  async (req) => {
    const { slug } = await req.json();

    if (typeof slug !== "string" || !slug.trim()) {
      throw new ValidationError("Pick an organisation.");
    }

    const org: any = await Organization.findOne({ slug: slug.toLowerCase() })
      .select("name slug")
      .lean();

    if (!org) throw new ValidationError("That organisation does not exist.");

    await logActivity({
      action: "admin.mode.entered",
      entityType: "Organization",
      entityId: org._id,
      entityLabel: org.name,
      orgId: org._id,
      severity: "critical",
    });

    const res = NextResponse.json({
      message: `Now acting as admin of ${org.name}.`,
    });
    res.cookies.set(ACTING_ORG_COOKIE, org.slug, COOKIE_BASE);
    return res;
  },
  { superAdminOnly: true, allowNoOrg: true },
);

export const DELETE = withContext(
  async () => {
    await logActivity({
      action: "admin.mode.left",
      entityType: "Organization",
      severity: "critical",
    });

    const res = NextResponse.json({ message: "Back to the platform console." });
    res.cookies.set(ACTING_ORG_COOKIE, "", { ...COOKIE_BASE, maxAge: 0 });
    return res;
  },
  { superAdminOnly: true, allowNoOrg: true },
);
