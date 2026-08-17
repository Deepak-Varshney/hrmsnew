"use client";

// Add and edit an employee.
//
// One component for both, because the two forms differ in exactly three ways:
// where they POST, whether a login can be created, and whether the employee
// code is editable. Keeping them separate would mean fixing every field twice.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { EmployeeFormOptions } from "@/lib/services/employeeForm";

const EMPLOYMENT_TYPES = [
  "full-time",
  "part-time",
  "contract",
  "intern",
  "consultant",
];
const WORK_MODES = ["onsite", "hybrid", "remote"];
const GENDERS = ["male", "female", "other"];
const STATUSES = ["active", "probation", "notice-period"];

/** Permission level, not job title — see the Designation field for that. */
const ROLES = [
  { id: "EMPLOYEE", label: "Employee — their own record only" },
  { id: "LEAD", label: "Lead — sees their team, approves leave" },
  { id: "MANAGER", label: "Manager — sees and edits their team" },
  { id: "ADMIN", label: "Admin — the whole organisation, including payroll" },
];

export interface EmployeeFormValues {
  firstName: string;
  middleName: string;
  lastName: string;
  employeeCode: string;
  dateOfBirth: string;
  gender: string;
  workEmail: string;
  personalEmail: string;
  personalPhone: string;
  workPhone: string;
  dateOfJoining: string;
  employmentType: string;
  workMode: string;
  status: string;
  probationMonths: string;
  departmentId: string;
  designationId: string;
  gradeId: string;
  locationId: string;
  reportsTo: string;
}

export const EMPTY_EMPLOYEE: EmployeeFormValues = {
  firstName: "",
  middleName: "",
  lastName: "",
  employeeCode: "",
  dateOfBirth: "",
  gender: "",
  workEmail: "",
  personalEmail: "",
  personalPhone: "",
  workPhone: "",
  dateOfJoining: "",
  employmentType: "full-time",
  workMode: "onsite",
  status: "active",
  probationMonths: "6",
  departmentId: "",
  designationId: "",
  gradeId: "",
  locationId: "",
  reportsTo: "",
};

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-surface p-5">
      <h2 className="text-sm font-semibold">{title}</h2>
      {hint ? (
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      ) : null}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">{children}</div>
    </section>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required ? <span className="ml-0.5 text-danger">*</span> : null}
      </Label>
      {children}
      {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}
    </div>
  );
}

function Select({
  value,
  onChange,
  options,
  placeholder = "Not set",
}: {
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; label: string }>;
  placeholder?: string;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 w-full rounded-md border bg-surface px-3 text-sm"
    >
      <option value="">{placeholder}</option>
      {options.map((o) => (
        <option key={o.id} value={o.id}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

const asOptions = (values: string[]) =>
  values.map((v) => ({ id: v, label: v.replace(/-/g, " ") }));

export function EmployeeForm({
  mode,
  options,
  initial,
  employeeId,
}: {
  mode: "create" | "edit";
  options: EmployeeFormOptions;
  initial: EmployeeFormValues;
  employeeId?: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState<EmployeeFormValues>(initial);
  const [createLogin, setCreateLogin] = useState(mode === "create");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginRole, setLoginRole] = useState("EMPLOYEE");
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const set = (key: keyof EmployeeFormValues, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function submit(e: React.FormEvent) {
    e.preventDefault();

    if (!form.firstName.trim()) return toast.error("First name is required.");
    if (!form.dateOfJoining) return toast.error("Date of joining is required.");
    if (createLogin && mode === "create") {
      if (!form.workEmail.trim()) {
        return toast.error("A work email is needed to create a login.");
      }
      if (loginPassword.length < 8) {
        return toast.error(
          "The temporary password must be at least 8 characters.",
        );
      }
    }

    setSaving(true);
    try {
      // The two routes take different shapes: POST is flat, PUT takes the
      // nested subdocuments the schema actually stores.
      const body =
        mode === "create"
          ? {
              firstName: form.firstName,
              middleName: form.middleName || undefined,
              lastName: form.lastName || undefined,
              employeeCode: form.employeeCode || undefined,
              dateOfBirth: form.dateOfBirth || undefined,
              gender: form.gender || undefined,
              workEmail: form.workEmail || undefined,
              personalEmail: form.personalEmail || undefined,
              personalPhone: form.personalPhone || undefined,
              workPhone: form.workPhone || undefined,
              dateOfJoining: form.dateOfJoining,
              employmentType: form.employmentType,
              workMode: form.workMode,
              probationMonths: Number(form.probationMonths || 0),
              departmentId: form.departmentId || undefined,
              designationId: form.designationId || undefined,
              gradeId: form.gradeId || undefined,
              locationId: form.locationId || undefined,
              reportsTo: form.reportsTo || undefined,
              // The API takes an object, not a flag — a bare `true` is
              // ignored and the person silently ends up unable to sign in.
              createLogin: createLogin
                ? {
                    email: form.workEmail,
                    password: loginPassword,
                    role: loginRole,
                  }
                : undefined,
            }
          : {
              firstName: form.firstName,
              middleName: form.middleName,
              lastName: form.lastName,
              dateOfBirth: form.dateOfBirth || null,
              gender: form.gender || undefined,
              contact: {
                workEmail: form.workEmail || undefined,
                personalEmail: form.personalEmail || undefined,
                personalPhone: form.personalPhone || undefined,
                workPhone: form.workPhone || undefined,
              },
              employment: {
                dateOfJoining: form.dateOfJoining,
                employmentType: form.employmentType,
                workMode: form.workMode,
                status: form.status,
                probationMonths: Number(form.probationMonths || 0),
              },
              departmentId: form.departmentId || null,
              designationId: form.designationId || null,
              gradeId: form.gradeId || null,
              locationId: form.locationId || null,
              reportsTo: form.reportsTo || null,
            };

      const res = await fetch(
        mode === "create" ? "/api/employees" : `/api/employees/${employeeId}`,
        {
          method: mode === "create" ? "POST" : "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );

      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not save");

      const id = result.employee?._id ?? result.employee?.id ?? employeeId;
      toast.success(
        mode === "create"
          ? `${form.firstName} added.${createLogin ? " A login was created." : ""}`
          : "Changes saved.",
      );

      router.replace(id ? `/employees/${id}` : "/employees");
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4">
      <Link
        href={employeeId ? `/employees/${employeeId}` : "/employees"}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
        {employeeId ? "Back to record" : "All employees"}
      </Link>

      <PageHeader
        title={mode === "create" ? "Add an employee" : "Edit employee"}
        description={
          mode === "create"
            ? "Only a name and a joining date are required. Everything else can be filled in later."
            : "Changes are written straight away and recorded in the activity log."
        }
      />

      <Section title="Identity">
        <Field label="First name" required>
          <Input
            value={form.firstName}
            onChange={(e) => set("firstName", e.target.value)}
          />
        </Field>
        <Field label="Middle name">
          <Input
            value={form.middleName}
            onChange={(e) => set("middleName", e.target.value)}
          />
        </Field>
        <Field label="Last name">
          <Input
            value={form.lastName}
            onChange={(e) => set("lastName", e.target.value)}
          />
        </Field>
        {mode === "create" ? (
          <Field
            label="Employee code"
            hint="Left blank, the next code in the org's sequence is used."
          >
            <Input
              value={form.employeeCode}
              onChange={(e) =>
                set("employeeCode", e.target.value.toUpperCase())
              }
              placeholder="Auto"
            />
          </Field>
        ) : null}
        <Field label="Date of birth">
          <Input
            type="date"
            value={form.dateOfBirth}
            onChange={(e) => set("dateOfBirth", e.target.value)}
          />
        </Field>
        <Field label="Gender">
          <Select
            value={form.gender}
            onChange={(v) => set("gender", v)}
            options={asOptions(GENDERS)}
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field
          label="Work email"
          hint={
            mode === "create"
              ? "Also the sign-in address if a login is created."
              : undefined
          }
        >
          <Input
            type="email"
            value={form.workEmail}
            onChange={(e) => set("workEmail", e.target.value)}
          />
        </Field>
        <Field label="Personal email">
          <Input
            type="email"
            value={form.personalEmail}
            onChange={(e) => set("personalEmail", e.target.value)}
          />
        </Field>
        <Field label="Personal phone">
          <Input
            value={form.personalPhone}
            onChange={(e) => set("personalPhone", e.target.value)}
          />
        </Field>
        <Field label="Work phone">
          <Input
            value={form.workPhone}
            onChange={(e) => set("workPhone", e.target.value)}
          />
        </Field>
      </Section>

      <Section title="Employment">
        <Field label="Date of joining" required>
          <Input
            type="date"
            value={form.dateOfJoining}
            onChange={(e) => set("dateOfJoining", e.target.value)}
          />
        </Field>
        <Field label="Employment type">
          <Select
            value={form.employmentType}
            onChange={(v) => set("employmentType", v)}
            options={asOptions(EMPLOYMENT_TYPES)}
            placeholder="full-time"
          />
        </Field>
        <Field label="Work mode">
          <Select
            value={form.workMode}
            onChange={(v) => set("workMode", v)}
            options={asOptions(WORK_MODES)}
            placeholder="onsite"
          />
        </Field>
        <Field label="Probation (months)">
          <Input
            type="number"
            min="0"
            value={form.probationMonths}
            onChange={(e) => set("probationMonths", e.target.value)}
          />
        </Field>
        {mode === "edit" ? (
          <Field
            label="Status"
            hint="Exits are recorded from the record page, not here."
          >
            <Select
              value={form.status}
              onChange={(v) => set("status", v)}
              options={asOptions(STATUSES)}
              placeholder="active"
            />
          </Field>
        ) : null}
      </Section>

      <Section
        title="Place in the organisation"
        hint="All optional — they drive filters, the org chart and payroll grouping."
      >
        <Field label="Department">
          <Select
            value={form.departmentId}
            onChange={(v) => set("departmentId", v)}
            options={options.departments}
          />
        </Field>
        <Field label="Designation">
          <Select
            value={form.designationId}
            onChange={(v) => set("designationId", v)}
            options={options.designations}
          />
        </Field>
        <Field label="Grade">
          <Select
            value={form.gradeId}
            onChange={(v) => set("gradeId", v)}
            options={options.grades}
          />
        </Field>
        <Field label="Location">
          <Select
            value={form.locationId}
            onChange={(v) => set("locationId", v)}
            options={options.locations}
          />
        </Field>
        <Field
          label="Reports to"
          hint="Decides what their manager and lead can see."
        >
          <Select
            value={form.reportsTo}
            onChange={(v) => set("reportsTo", v)}
            options={options.managers}
            placeholder="Nobody"
          />
        </Field>
      </Section>

      {mode === "create" ? (
        <Section
          title="Access"
          hint="Without a login the person exists on the roster but cannot sign in."
        >
          <Field label="Create a login">
            <label className="flex h-9 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={createLogin}
                onChange={(e) => setCreateLogin(e.target.checked)}
                className="h-4 w-4 rounded border-border accent-primary"
              />
              Let them sign in with their work email
            </label>
          </Field>

          {createLogin ? (
            <>
              <Field
                label="Temporary password"
                required
                hint="At least 8 characters. Share it with them and ask them to change it under Profile → Security."
              >
                <Input
                  type="text"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  placeholder="At least 8 characters"
                />
              </Field>
              <Field
                label="Permission level"
                hint="What they can see and do. Different from their designation."
              >
                <Select
                  value={loginRole}
                  onChange={setLoginRole}
                  options={ROLES}
                  placeholder="Employee"
                />
              </Field>
            </>
          ) : null}
        </Section>
      ) : null}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving
            ? "Saving…"
            : mode === "create"
              ? "Add employee"
              : "Save changes"}
        </Button>
      </div>
    </form>
  );
}
