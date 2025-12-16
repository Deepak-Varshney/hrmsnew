// app/api/policies/route.ts
import { NextResponse } from "next/server";
import {  requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import Policy from "@/model/Policy";
import AuditLog from "@/model/AuditLog";
import { requireAuth } from "@/lib/requireAuth";

// GET - List policies (all users can view)
export async function GET(req: Request) {
  try {
    await requireAuth(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const isActive = searchParams.get("isActive");
    const search = searchParams.get("search");

    const query: any = {};
    if (category) query.category = category;
    if (isActive !== null) query.isActive = isActive === "true";
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
      ];
    }

    const policies = await Policy.find(query)
      .populate("createdBy", "name email")
      .sort({ createdAt: -1 })
      .lean();

    return NextResponse.json({ policies });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Unauthorized" },
      { status: 401 }
    );
  }
}

// POST - Create policy (HR/Admin only)
export async function POST(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const {
      title,
      category,
      description,
      fileUrl,
      version,
      effectiveDate,
      isActive,
    } = await req.json();

    if (!title || !category || !fileUrl || !version || !effectiveDate) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    const policy = await Policy.create({
      title,
      category,
      description,
      fileUrl,
      version,
      effectiveDate: new Date(effectiveDate),
      isActive: isActive !== false,
      createdBy: (user as any)._id,
    });

    await policy.populate("createdBy", "name email");

    // Log audit
    await AuditLog.create({
      action: "policy_create",
      userId: (user as any)._id,
      entityType: "Policy",
      entityId: policy._id,
      newValue: { title, category, version },
      remarks: `Policy "${title}" created`,
    });

    return NextResponse.json({ policy });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || "Server error" },
      { status: err.message?.includes("Unauthorized") ? 401 : 500 }
    );
  }
}

