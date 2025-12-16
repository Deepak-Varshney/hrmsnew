// app/api/policies/[id]/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { requireAuth } from "@/lib/requireAuth";
import { connect } from "@/lib/mongoose";
import Policy from "@/model/Policy";
import AuditLog from "@/model/AuditLog";

// GET - Get single policy
export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req);
    await connect();
    const { id } = await params;

    const policy = await Policy.findById(id)
      .populate("createdBy", "name email")
      .lean();

    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    return NextResponse.json({ policy });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}

// PUT - Update policy (HR/Admin only)
export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireHR(req);
    await connect();
    const { id } = await params;

    const policy = await Policy.findById(id);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    const oldValue = {
      title: policy.title,
      category: policy.category,
      version: policy.version,
      isActive: policy.isActive,
    };

    const {
      title,
      category,
      description,
      fileUrl,
      version,
      effectiveDate,
      isActive,
    } = await req.json();

    if (title) policy.title = title;
    if (category) policy.category = category;
    if (description !== undefined) policy.description = description;
    if (fileUrl) policy.fileUrl = fileUrl;
    if (version) policy.version = version;
    if (effectiveDate) policy.effectiveDate = new Date(effectiveDate);
    if (isActive !== undefined) policy.isActive = isActive;

    await policy.save();
    await policy.populate("createdBy", "name email");

    // Log audit
    await AuditLog.create({
      action: "policy_update",
      userId: (user as any)._id,
      entityType: "Policy",
      entityId: policy._id,
      oldValue,
      newValue: {
        title: policy.title,
        category: policy.category,
        version: policy.version,
        isActive: policy.isActive,
      },
      remarks: `Policy "${policy.title}" updated`,
    });

    return NextResponse.json({ policy });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

// DELETE - Archive/deactivate policy (HR/Admin only)
export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user } = await requireHR(req);
    await connect();
    const { id } = await params;

    const policy = await Policy.findById(id);
    if (!policy) {
      return NextResponse.json({ error: "Policy not found" }, { status: 404 });
    }

    // Soft delete by setting isActive to false
    policy.isActive = false;
    await policy.save();

    // Log audit
    await AuditLog.create({
      action: "policy_archive",
      userId: (user as any)._id,
      entityType: "Policy",
      entityId: policy._id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
      remarks: `Policy "${policy.title}" archived`,
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

