// app/api/employees/[id]/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import User from "@/model/User";
import Employee from "@/model/Employee";
import AuditLog from "@/model/AuditLog";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const userData = await User.findById(params.id).lean();
    if (!userData) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    const employeeData = await Employee.findOne({ userId: params.id })
      .populate("managerId", "name email")
      .lean();

    return NextResponse.json({
      employee: {
        ...userData,
        employee: employeeData,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const {
      name,
      email,
      role,
      isActive,
      employeeCode,
      department,
      designation,
      managerId,
      joiningDate,
      phone,
      address,
      emergencyContact,
    } = await req.json();

    const existingUser = await User.findById(params.id);
    if (!existingUser) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Store old values for audit
    const oldValues = {
      name: existingUser.name,
      email: existingUser.email,
      role: existingUser.role,
      isActive: existingUser.isActive,
    };

    // Update user
    if (name) existingUser.name = name;
    if (email) existingUser.email = email;
    if (role) existingUser.role = role;
    if (isActive !== undefined) existingUser.isActive = isActive;
    await existingUser.save();

    // Update or create employee record
    let employee = await Employee.findOne({ userId: params.id });
    if (!employee) {
      employee = await Employee.create({ userId: params.id });
    }

    if (employeeCode !== undefined) employee.employeeCode = employeeCode;
    if (department !== undefined) employee.department = department;
    if (designation !== undefined) employee.designation = designation;
    if (managerId !== undefined) employee.managerId = managerId;
    if (joiningDate !== undefined) employee.joiningDate = new Date(joiningDate);
    if (phone !== undefined) employee.phone = phone;
    if (address !== undefined) employee.address = address;
    if (emergencyContact !== undefined) employee.emergencyContact = emergencyContact;
    await employee.save();

    // Log audit
    await AuditLog.create({
      action: "employee_update",
      userId: (user as any)._id,
      targetUserId: params.id,
      entityType: "User",
      entityId: params.id,
      oldValue: oldValues,
      newValue: {
        name: existingUser.name,
        email: existingUser.email,
        role: existingUser.role,
        isActive: existingUser.isActive,
      },
      remarks: `Employee updated by ${(user as any).name}`,
    });

    return NextResponse.json({
      success: true,
      message: "Employee updated successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const existingUser = await User.findById(params.id);
    if (!existingUser) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }

    // Deactivate instead of delete
    existingUser.isActive = false;
    await existingUser.save();

    // Log audit
    await AuditLog.create({
      action: "employee_deactivate",
      userId: (user as any)._id,
      targetUserId: params.id,
      entityType: "User",
      entityId: params.id,
      oldValue: { isActive: true },
      newValue: { isActive: false },
      remarks: `Employee deactivated by ${(user as any).name}`,
    });

    return NextResponse.json({
      success: true,
      message: "Employee deactivated successfully",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

