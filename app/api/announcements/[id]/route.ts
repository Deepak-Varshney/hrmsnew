// app/api/announcements/[id]/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import Announcement from "@/model/Announcement";
import AuditLog from "@/model/AuditLog";
import { requireAuth } from "@/lib/requireAuth";

// GET - Get single announcement
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req);
    await connect();
    const { id } = await params;

    const announcement = await Announcement.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ announcement });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}

// PUT - Update announcement (HR/Admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireHR(req);
    await connect();
    const { id } = await params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    const oldValue = {
      title: announcement.title,
      isPinned: announcement.isPinned,
      targetRoles: announcement.targetRoles,
    };

    const {
      title,
      content,
      isPinned,
      sendEmail,
      targetRoles,
      expiresAt,
    } = await req.json();

    if (title) announcement.title = title;
    if (content) announcement.content = content;
    if (isPinned !== undefined) announcement.isPinned = isPinned;
    if (sendEmail !== undefined) announcement.sendEmail = sendEmail;
    if (targetRoles !== undefined) announcement.targetRoles = targetRoles;
    if (expiresAt !== undefined)
      announcement.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

    await announcement.save();
    await announcement.populate("createdBy", "name email");

    // Log audit
    await AuditLog.create({
      action: "announcement_update",
      userId: (user as any)._id,
      entityType: "Announcement",
      entityId: announcement._id,
      oldValue,
      newValue: {
        title: announcement.title,
        isPinned: announcement.isPinned,
        targetRoles: announcement.targetRoles,
      },
      remarks: `Announcement "${announcement.title}" updated`,
    });

    return NextResponse.json({ announcement });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

// DELETE - Delete announcement (HR/Admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireHR(req);
    await connect();
    const { id } = await params;

    const announcement = await Announcement.findById(id);
    if (!announcement) {
      return NextResponse.json(
        { error: "Announcement not found" },
        { status: 404 }
      );
    }

    const title = announcement.title;
    await announcement.deleteOne();

    // Log audit
    await AuditLog.create({
      action: "announcement_delete",
      userId: (user as any)._id,
      entityType: "Announcement",
      entityId: announcement._id,
      oldValue: { title },
      remarks: `Announcement "${title}" deleted`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

