// app/api/profile/route.ts
//
// Self-service edits to your own record. Only the whitelisted fields are
// accepted; anything else is reported back rather than silently dropped, so
// the UI can say why nothing changed.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { getContext } from "@/lib/context";
import { SELF_EDITABLE_EMPLOYEE_FIELDS } from "@/lib/rbac/permissions";
import { logActivity } from "@/lib/activity";
import { serializeEmployee } from "@/lib/rbac";
import Employee from "@/model/Employee";

export const PATCH = withContext(async (req) => {
  const ctx = getContext()!;
  if (!ctx.employeeId) {
    return NextResponse.json({ error: "No employee record" }, { status: 400 });
  }

  const employee = await Employee.findById(ctx.employeeId);
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const body = (await req.json()) ?? {};
  const applied: string[] = [];
  const rejected: string[] = [];

  for (const [key, value] of Object.entries(body)) {
    if (!SELF_EDITABLE_EMPLOYEE_FIELDS.has(key)) {
      rejected.push(key);
      continue;
    }

    if (key === "bank" && value && typeof value === "object") {
      // An empty account number means "leave it alone" — the form shows a
      // masked value, so submitting it unchanged must not wipe the real one.
      const incoming = { ...(value as Record<string, any>) };
      if (!incoming.accountNumber?.trim()) delete incoming.accountNumber;

      employee.set("bank", { ...(employee.bank ?? {}), ...incoming });
      applied.push(key);
      continue;
    }

    if (key === "contact" && value && typeof value === "object") {
      // Merge rather than replace: the work email is not self-editable and
      // must survive a personal-details save.
      const current = employee.contact ?? {};
      const incoming = value as Record<string, any>;
      employee.set("contact", {
        ...current,
        ...incoming,
        workEmail: current.workEmail,
        workPhone: incoming.workPhone ?? current.workPhone,
      });
      applied.push(key);
      continue;
    }

    employee.set(key, value);
    applied.push(key);
  }

  if (applied.length === 0) {
    return NextResponse.json(
      {
        error:
          rejected.length > 0
            ? `Those fields need HR to change them: ${rejected.join(", ")}`
            : "Nothing to update",
      },
      { status: 400 }
    );
  }

  await employee.save();

  // Bank changes are the payroll-fraud vector — surface them loudly enough
  // that HR can notice one they did not expect.
  if (applied.includes("bank")) {
    await logActivity({
      action: "employee.bank.changed",
      entityType: "Employee",
      entityId: employee._id,
      entityLabel: `${employee.displayName} (${employee.employeeCode})`,
      metadata: { changedBySelf: true },
      severity: "critical",
    });
  }

  return NextResponse.json({
    employee: serializeEmployee(employee),
    applied,
    ...(rejected.length > 0 ? { rejected } : {}),
    message: "Saved.",
  });
});
