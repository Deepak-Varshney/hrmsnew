// app/api/announcements/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import Announcement from "@/model/Announcement";
import AuditLog from "@/model/AuditLog";
import { requireAuth } from "@/lib/requireAuth";

// GET - List announcements (filtered by role and expiration)
export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const isPinned = searchParams.get("isPinned");
    const role = (user as any).role;

    const query: any = {
      $and: [
        {
          $or: [
            { targetRoles: { $size: 0 } }, // Visible to all
            { targetRoles: { $in: [role] } }, // Visible to user's role
          ],
        },
        {
          $or: [
            { expiresAt: { $exists: false } }, // No expiration
            { expiresAt: { $gte: new Date() } }, // Not expired
          ],
        },
      ],
    };

    if (isPinned !== null) {
      query.isPinned = isPinned === "true";
    }

    const announcements = await Announcement.find(query)
      .populate("createdBy", "name email")
      .sort({ isPinned: -1, createdAt: -1 })
      .lean();

    return NextResponse.json({ announcements });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}

// POST - Create announcement (HR/Admin only)
export async function POST(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const {
      title,
      content,
      isPinned,
      sendEmail,
      targetRoles,
      expiresAt,
    } = await req.json();

    if (!title || !content) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const announcement = await Announcement.create({
      title,
      content,
      isPinned: isPinned || false,
      sendEmail: sendEmail || false,
      targetRoles: targetRoles || [],
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
      createdBy: (user as any)._id,
    });

    await announcement.populate("createdBy", "name email");

    // Log audit
    await AuditLog.create({
      action: "announcement_create",
      userId: (user as any)._id,
      entityType: "Announcement",
      entityId: announcement._id,
      newValue: { title, isPinned, targetRoles },
      remarks: `Announcement "${title}" created`,
    });

    // TODO: Send email if sendEmail is true
    // if (sendEmail) {
    //   await sendAnnouncementEmail(announcement);
    // }

    return NextResponse.json({ announcement });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

