// app/api/settings/route.ts
import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import Settings from "@/model/Settings";
import AuditLog from "@/model/AuditLog";

// GET - Get settings (Admin only)
export async function GET(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    await connect();

    // Use singleton pattern - get or create the only settings document
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

// PUT - Update settings (Admin only)
export async function PUT(req: Request) {
  try {
    const { user } = await requireAdmin(req);
    await connect();

    const {
      officeStartTime,
      officeEndTime,
      weeklyOffs,
      geoFenceEnabled,
      geoFenceRadius,
      ipRestrictionEnabled,
      allowedIPs,
    } = await req.json();

    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }

    const oldValue = {
      officeStartTime: settings.officeStartTime,
      officeEndTime: settings.officeEndTime,
      weeklyOffs: settings.weeklyOffs,
      geoFenceEnabled: settings.geoFenceEnabled,
      geoFenceRadius: settings.geoFenceRadius,
      ipRestrictionEnabled: settings.ipRestrictionEnabled,
      allowedIPs: settings.allowedIPs,
    };

    if (officeStartTime !== undefined) settings.officeStartTime = officeStartTime;
    if (officeEndTime !== undefined) settings.officeEndTime = officeEndTime;
    if (weeklyOffs !== undefined) settings.weeklyOffs = weeklyOffs;
    if (geoFenceEnabled !== undefined) settings.geoFenceEnabled = geoFenceEnabled;
    if (geoFenceRadius !== undefined) settings.geoFenceRadius = geoFenceRadius;
    if (ipRestrictionEnabled !== undefined) settings.ipRestrictionEnabled = ipRestrictionEnabled;
    if (allowedIPs !== undefined) settings.allowedIPs = allowedIPs;

    await settings.save();

    // Log audit
    await AuditLog.create({
      action: "settings_update",
      userId: (user as any)._id,
      entityType: "Settings",
      entityId: settings._id,
      oldValue,
      newValue: {
        officeStartTime: settings.officeStartTime,
        officeEndTime: settings.officeEndTime,
        weeklyOffs: settings.weeklyOffs,
        geoFenceEnabled: settings.geoFenceEnabled,
        geoFenceRadius: settings.geoFenceRadius,
        ipRestrictionEnabled: settings.ipRestrictionEnabled,
        allowedIPs: settings.allowedIPs,
      },
      remarks: `Settings updated by ${(user as any).name}`,
    });

    return NextResponse.json({ settings });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}
