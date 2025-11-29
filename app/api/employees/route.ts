// app/api/employees/route.ts
import { NextResponse } from "next/server";
import { requireHR } from "@/lib/requireRole";
import { connect } from "@/lib/mongoose";
import User from "@/model/User";
import Employee from "@/model/Employee";
import { hashPassword } from "@/lib/auth";
import AuditLog from "@/model/AuditLog";

export async function GET(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role");
    const department = searchParams.get("department");
    const isActive = searchParams.get("isActive");

    const query: any = {};
    if (role) query.role = role;
    if (isActive !== null) query.isActive = isActive === "true";

    const users = await User.find(query).lean();
    const employees = await Employee.find().populate("userId").lean();

    // Merge user and employee data
    const employeeList = users.map((u: any) => {
      const emp = employees.find((e: any) => e.userId._id.toString() === u._id.toString());
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        isActive: u.isActive,
        employeeCode: emp?.employeeCode,
        department: emp?.department,
        designation: emp?.designation,
        managerId: emp?.managerId,
        joiningDate: emp?.joiningDate,
        phone: emp?.phone,
        createdAt: u.createdAt,
      };
    });

    // Filter by department if specified
    let filtered = employeeList;
    if (department) {
      filtered = employeeList.filter((e) => e.department === department);
    }

    return NextResponse.json({ employees: filtered });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}

export async function POST(req: Request) {
  try {
    const { user } = await requireHR(req);
    await connect();

    const {
      name,
      email,
      password,
      role,
      employeeCode,
      department,
      designation,
      managerId,
      joiningDate,
      phone,
      address,
      emergencyContact,
    } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    const existing = await User.findOne({ email });
    if (existing) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    // Create user
    const passwordHash = await hashPassword(password);
    const newUser = await User.create({
      name,
      email,
      passwordHash,
      role: role || "Employee",
      isActive: true,
    });

    // Create employee record
    const employeeData: any = {
      userId: newUser._id,
    };
    if (employeeCode) employeeData.employeeCode = employeeCode;
    if (department) employeeData.department = department;
    if (designation) employeeData.designation = designation;
    if (managerId) employeeData.managerId = managerId;
    if (joiningDate) employeeData.joiningDate = new Date(joiningDate);
    if (phone) employeeData.phone = phone;
    if (address) employeeData.address = address;
    if (emergencyContact) employeeData.emergencyContact = emergencyContact;

    await Employee.create(employeeData);

    // Log audit
    await AuditLog.create({
      action: "employee_create",
      userId: (user as any)._id,
      targetUserId: newUser._id,
      entityType: "User",
      entityId: newUser._id,
      newValue: { name, email, role: role || "Employee" },
      remarks: `Employee created by ${(user as any).name}`,
    });

    return NextResponse.json({
      success: true,
      employee: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
      },
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}

