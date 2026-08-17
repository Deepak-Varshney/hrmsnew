"use client";

// A person's record. Read-only — see the note on the page component.

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ArrowLeft, FileText, Mail, Phone, Pencil, Trash2 } from "lucide-react";

import { StatusPill, EMPLOYEE_STATUS_TONE } from "@/components/ui/status-pill";
import { Button } from "@/components/ui/button";
import { formatDate, formatINR } from "@/lib/format";
import { initialsOf } from "@/components/app/TopBar";

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-2 py-2">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium">{value ?? "—"}</span>
    </div>
  );
}

function Card({
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
        <p className="mt-0.5 text-xs text-subtle-foreground">{hint}</p>
      ) : null}
      <div className="mt-2 divide-y">{children}</div>
    </section>
  );
}

export function EmployeeRecordClient({
  profile,
  viewerRole,
  employeeId,
  canEdit = false,
  canDelete = false,
}: {
  profile: any;
  viewerRole: string;
  employeeId?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const e = profile.employee ?? {};
  const emp = e.employment ?? {};
  const contact = e.contact ?? {};
  const salary = profile.salary;

  // serializeEmployee strips these entirely without employee.pii.read, and
  // masks them with it. Absent means the viewer is not allowed to see them.
  const seesPii = Boolean(e.statutory || e.bank);

  async function remove() {
    // Soft delete — the record goes to the recycle bin, not away. Say so, so
    // nobody hesitates over a decision that is reversible.
    const ok = window.confirm(
      `Remove ${e.displayName} from the roster?\n\nThis is reversible — the record moves to the recycle bin and only a super admin can destroy it for good.`,
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/employees/${employeeId}`, {
        method: "DELETE",
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not remove");
      toast.success(result.message ?? `${e.displayName} removed.`);
      router.replace("/employees");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
      setDeleting(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/employees"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden />
          All employees
        </Link>

        <div className="flex gap-2">
          {canEdit ? (
            <Button asChild size="sm" variant="outline">
              <Link href={`/employees/${employeeId}/edit`}>
                <Pencil className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                Edit
              </Link>
            </Button>
          ) : null}
          {canDelete ? (
            <Button
              size="sm"
              variant="ghost"
              onClick={remove}
              disabled={deleting}
              className="text-danger hover:bg-danger/10"
            >
              <Trash2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Remove
            </Button>
          ) : null}
        </div>
      </div>

      <header className="flex flex-wrap items-center gap-4 rounded-lg border bg-surface p-5">
        {e.photo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={e.photo}
            alt=""
            className="h-16 w-16 rounded-full object-cover"
          />
        ) : (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-muted text-lg font-semibold">
            {initialsOf(e.displayName ?? "?")}
          </span>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-xl font-semibold">{e.displayName}</h1>
            <StatusPill tone={EMPLOYEE_STATUS_TONE[emp.status] ?? "neutral"}>
              {emp.status ?? "unknown"}
            </StatusPill>
            {profile.role ? (
              <StatusPill tone="neutral" dot={false}>
                {profile.role}
              </StatusPill>
            ) : null}
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {e.employeeCode}
            {e.designationId?.title ? ` · ${e.designationId.title}` : ""}
            {e.departmentId?.name ? ` · ${e.departmentId.name}` : ""}
          </p>

          <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted-foreground">
            {contact.workEmail ? (
              <a
                href={`mailto:${contact.workEmail}`}
                className="inline-flex items-center gap-1.5 hover:text-foreground"
              >
                <Mail className="h-3.5 w-3.5" aria-hidden />
                {contact.workEmail}
              </a>
            ) : null}
            {contact.personalPhone ? (
              <span className="inline-flex items-center gap-1.5">
                <Phone className="h-3.5 w-3.5" aria-hidden />
                {contact.personalPhone}
              </span>
            ) : null}
          </div>
        </div>

        {profile.manager ? (
          <div className="text-right">
            <p className="eyebrow">Reports to</p>
            <Link
              href={`/employees/${profile.manager.id}`}
              className="text-sm font-medium text-primary hover:underline"
            >
              {profile.manager.displayName}
            </Link>
            <p className="text-xs text-subtle-foreground">
              {profile.manager.designation ?? profile.manager.employeeCode}
            </p>
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Employment">
          <Row label="Joined" value={formatDate(emp.dateOfJoining)} />
          <Row label="Employment type" value={emp.employmentType} />
          <Row label="Work mode" value={emp.workMode} />
          <Row
            label="Probation"
            value={emp.probationMonths ? `${emp.probationMonths} months` : null}
          />
          <Row label="Grade" value={e.gradeId?.name} />
          <Row label="Location" value={e.locationId?.name} />
        </Card>

        <Card title="Personal">
          <Row label="Date of birth" value={formatDate(e.dateOfBirth)} />
          <Row label="Gender" value={e.gender} />
          <Row label="Personal email" value={contact.personalEmail} />
          <Row
            label="City"
            value={
              contact.currentAddress?.city ?? contact.currentAddress?.state
            }
          />
        </Card>

        {salary ? (
          <Card
            title="Compensation"
            hint="Current structure. Payslips are generated from this."
          >
            <Row label="Annual CTC" value={formatINR(salary.annualCtc)} />
            <Row label="Monthly gross" value={formatINR(salary.monthlyGross)} />
            <Row
              label="Effective from"
              value={formatDate(salary.effectiveFrom)}
            />
            {(salary.components ?? []).map((c: any) => (
              <Row key={c.code} label={c.name} value={formatINR(c.monthly)} />
            ))}
          </Card>
        ) : null}

        {seesPii ? (
          <Card
            title="Statutory and bank"
            hint="Masked. Revealing a full value is recorded in the activity log."
          >
            <Row label="PAN" value={e.statutory?.pan} />
            <Row label="Aadhaar" value={e.statutory?.aadhaar} />
            <Row label="UAN" value={e.statutory?.uan} />
            <Row label="Bank" value={e.bank?.bankName} />
            <Row label="Account" value={e.bank?.accountNumber} />
            <Row label="IFSC" value={e.bank?.ifsc} />
          </Card>
        ) : (
          <Card
            title="Statutory and bank"
            hint={`Not visible to a ${viewerRole.toLowerCase()}.`}
          >
            <p className="py-3 text-sm text-muted-foreground">
              Aadhaar, PAN and bank details are restricted to HR. They are
              encrypted at rest and never sent to a client that cannot show
              them.
            </p>
          </Card>
        )}

        {emp.status === "exited" || e.exit?.lastWorkingDay ? (
          <Card title="Exit">
            <Row label="Resigned" value={formatDate(e.exit?.resignationDate)} />
            <Row
              label="Last working day"
              value={formatDate(e.exit?.lastWorkingDay)}
            />
            <Row label="Reason" value={e.exit?.exitReason} />
            <Row
              label="Eligible for rehire"
              value={e.exit?.rehireEligible ? "Yes" : "No"}
            />
          </Card>
        ) : null}

        <Card
          title="Documents"
          hint="Uploaded by the employee or issued by HR."
        >
          {(profile.documents?.company ?? []).length === 0 &&
          (profile.documents?.personal ?? []).length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              Nothing on file yet.
            </p>
          ) : (
            [
              ...(profile.documents?.company ?? []),
              ...(profile.documents?.personal ?? []),
            ].map((d: any) => (
              <div key={String(d._id)} className="flex items-center gap-2 py-2">
                <FileText
                  className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                  aria-hidden
                />
                <span className="min-w-0 flex-1 truncate text-sm">
                  {d.title ?? d.type}
                </span>
                <span className="text-xs text-subtle-foreground">
                  {formatDate(d.createdAt)}
                </span>
              </div>
            ))
          )}
        </Card>
      </div>

      {(profile.history ?? []).length > 0 ? (
        <Card
          title="Employment history"
          hint="Every change, oldest at the bottom."
        >
          {profile.history.map((h: any) => (
            <div
              key={String(h._id)}
              className="flex flex-wrap items-baseline justify-between gap-2 py-2"
            >
              <span className="text-sm">
                <span className="font-medium">{h.changeType}</span>
                {h.field ? (
                  <span className="text-muted-foreground"> · {h.field}</span>
                ) : null}
              </span>
              <span className="text-xs text-subtle-foreground">
                {formatDate(h.effectiveFrom)}
                {h.changedByName ? ` · ${h.changedByName}` : ""}
              </span>
            </div>
          ))}
        </Card>
      ) : null}
    </>
  );
}
