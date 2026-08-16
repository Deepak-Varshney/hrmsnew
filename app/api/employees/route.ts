// app/api/employees/route.ts
import { NextResponse } from "next/server";
import mongoose from "mongoose";

import { withContext } from "@/lib/withContext";
import { requireOrgId } from "@/lib/context";
import { listEmployees } from "@/lib/services/employeeQueries";
import Employee from "@/model/Employee";
import User from "@/model/User";
import Membership from "@/model/Membership";
import EmploymentHistory from "@/model/EmploymentHistory";
import { hashPassword } from "@/lib/auth";
import {
  ConflictError,
  ValidationError,
  assertNoReportingCycle,
  generateEmployeeCode,
} from "@/lib/services/employee";

/**
 * GET /api/employees
 *
 * Scope-aware: an ADMIN sees the org, a MANAGER sees their reporting subtree,
 * an EMPLOYEE sees only themselves. The filter comes from the RBAC scope, and
 * orgId is pinned by the tenantScope plugin.
 */
export const GET = withContext(
  async (req) => {
    const url = new URL(req.url);
    const result = await listEmployees({
      search: url.searchParams.get("search")?.trim() ?? undefined,
      status: url.searchParams.get("status") ?? undefined,
      departmentId: url.searchParams.get("departmentId") ?? undefined,
      locationId: url.searchParams.get("locationId") ?? undefined,
      page: Number(url.searchParams.get("page") ?? 1),
      limit: Number(url.searchParams.get("limit") ?? 50),
    });

    return NextResponse.json(result);
  },
  { permission: "employee.read" }
);

/**
 * POST /api/employees
 *
 * Creates the employee record, and optionally a login (User + Membership).
 * An employee can exist without a login — contractors and pre-joiners often do.
 */
export const POST = withContext(
  async (req) => {
    const orgId = requireOrgId();
    const body = await req.json();

    const {
      firstName,
      middleName,
      lastName,
      workEmail,
      personalEmail,
      workPhone,
      personalPhone,
      dateOfJoining,
      employmentType,
      workMode,
      probationMonths,
      departmentId,
      designationId,
      locationId,
      gradeId,
      reportsTo,
      dateOfBirth,
      gender,
      employeeCode: providedCode,
      createLogin,
    } = body ?? {};

    if (!firstName?.trim()) throw new ValidationError("firstName is required.");
    if (!dateOfJoining) throw new ValidationError("dateOfJoining is required.");

    if (workEmail) {
      const clash = await Employee.findOne({ "contact.workEmail": workEmail.toLowerCase() });
      if (clash) {
        throw new ConflictError("An employee with that work email already exists.");
      }
    }

    if (reportsTo) {
      const manager = await Employee.findById(reportsTo).select("_id");
      if (!manager) throw new ValidationError("Reporting manager not found.");
    }

    const employeeCode =
      providedCode?.trim()?.toUpperCase() || (await generateEmployeeCode(orgId));

    const employee = await Employee.create({
      orgId,
      employeeCode,
      firstName: firstName.trim(),
      middleName: middleName?.trim(),
      lastName: lastName?.trim(),
      dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : undefined,
      gender,
      contact: {
        workEmail: workEmail?.toLowerCase(),
        personalEmail: personalEmail?.toLowerCase(),
        workPhone,
        personalPhone,
      },
      employment: {
        dateOfJoining: new Date(dateOfJoining),
        probationMonths: probationMonths ?? 6,
        employmentType: employmentType ?? "full-time",
        workMode: workMode ?? "onsite",
        status: "probation",
      },
      departmentId: departmentId || null,
      designationId: designationId || null,
      locationId: locationId || null,
      gradeId: gradeId || null,
      reportsTo: reportsTo || null,
    });

    await EmploymentHistory.create({
      orgId,
      employeeId: employee._id,
      changeType: "joined",
      field: "employment.dateOfJoining",
      newValue: employee.employment.dateOfJoining,
      effectiveFrom: employee.employment.dateOfJoining,
    });

    // Optional portal login.
    let user: any = null;
    if (createLogin?.password) {
      const loginEmail = (createLogin.email ?? workEmail)?.toLowerCase();
      if (!loginEmail) {
        throw new ValidationError("A login requires an email address.");
      }
      if (String(createLogin.password).length < 8) {
        throw new ValidationError("Password must be at least 8 characters.");
      }

      const existingUser = await User.findOne({ email: loginEmail });
      if (existingUser) {
        throw new ConflictError("A user with that email already exists.");
      }

      user = await User.create({
        name: employee.displayName,
        email: loginEmail,
        passwordHash: await hashPassword(createLogin.password),
        status: "active",
      });

      // Role here is the permission level, NOT the job title. A Developer
      // who leads a team gets MANAGER; designation stays "Developer".
      await Membership.create({
        userId: user._id,
        orgId,
        role: createLogin.role ?? "EMPLOYEE",
        employeeId: employee._id,
        status: "active",
        joinedAt: new Date(),
      });

      employee.userId = user._id;
      await employee.save();
    }

    return NextResponse.json(
      {
        success: true,
        employee: {
          _id: employee._id,
          userId: employee.userId ?? null,
          employeeCode: employee.employeeCode,
          displayName: employee.displayName,
        },
      },
      { status: 201 }
    );
  },
  { permission: "employee.create" }
);
