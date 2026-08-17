"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Briefcase,
  UserRound,
  Wallet,
  FileText,
  Megaphone,
  KeyRound,
  Mail,
  Phone,
  CalendarDays,
  Building2,
  MapPin,
  UserCog,
  ShieldAlert,
  Save,
} from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, EMPLOYEE_STATUS_TONE, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DocumentsCard } from "@/components/documents/DocumentsCard";
import { PERSONAL_CATEGORIES, COMPANY_CATEGORIES } from "@/lib/documentCategories";
import { initialsOf } from "@/components/app/TopBar";
import { formatINR, formatDate, monthLabel } from "@/lib/format";

const TABS = [
  { id: "employment", label: "Employment", icon: Briefcase },
  { id: "personal", label: "Personal", icon: UserRound },
  { id: "pay", label: "Work & pay", icon: Wallet },
  { id: "documents", label: "Documents", icon: FileText },
  { id: "notices", label: "HR notices", icon: Megaphone },
  { id: "security", label: "Security", icon: KeyRound },
] as const;

type TabId = (typeof TABS)[number]["id"];

const NOTICE_TONE: Record<string, PillTone> = {
  appreciation: "success",
  warning: "danger",
  memo: "info",
  confirmation: "primary",
  general: "neutral",
};

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  "notice-period": "Notice period",
  "on-leave": "On leave",
  exited: "Departed",
};

function Field({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: React.ReactNode;
  icon?: any;
}) {
  return (
    <div>
      <dt className="eyebrow flex items-center gap-1.5">
        {Icon ? <Icon className="h-3 w-3" aria-hidden /> : null}
        {label}
      </dt>
      <dd className="mt-1 text-sm">{value || <span className="text-subtle-foreground">—</span>}</dd>
    </div>
  );
}

function Panel({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-lg border bg-surface p-4 sm:p-5">
      <h3 className="text-base font-semibold">{title}</h3>
      {description ? (
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      ) : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function ProfileClient({
  profile,
  role,
  email,
  storageReady,
}: {
  profile: any;
  role: string;
  email: string;
  storageReady: boolean;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>("employment");
  const [, startTransition] = useTransition();

  const employee = profile.employee;
  const [saving, setSaving] = useState(false);

  const [personal, setPersonal] = useState({
    personalEmail: employee.contact?.personalEmail ?? "",
    personalPhone: employee.contact?.personalPhone ?? "",
    dateOfBirth: employee.dateOfBirth ? employee.dateOfBirth.slice(0, 10) : "",
    maritalStatus: employee.maritalStatus ?? "",
    bloodGroup: employee.bloodGroup ?? "",
    addressLine1: employee.contact?.currentAddress?.line1 ?? "",
    city: employee.contact?.currentAddress?.city ?? "",
    state: employee.contact?.currentAddress?.state ?? "",
    pincode: employee.contact?.currentAddress?.pincode ?? "",
  });

  const [bank, setBank] = useState({
    accountHolderName: employee.bank?.accountHolderName ?? "",
    accountNumber: "",
    ifsc: employee.bank?.ifsc ?? "",
    bankName: employee.bank?.bankName ?? "",
    branch: employee.bank?.branch ?? "",
  });

  const [passwords, setPasswords] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  async function savePersonal() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact: {
            personalEmail: personal.personalEmail,
            personalPhone: personal.personalPhone,
            currentAddress: {
              line1: personal.addressLine1,
              city: personal.city,
              state: personal.state,
              pincode: personal.pincode,
              country: "India",
            },
          },
          dateOfBirth: personal.dateOfBirth || undefined,
          maritalStatus: personal.maritalStatus || undefined,
          bloodGroup: personal.bloodGroup || undefined,
          bank,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save");

      toast.success(body.message);
      if (bank.accountNumber) {
        toast.info("Bank details changed", {
          description: "HR is notified whenever bank details are updated.",
        });
      }
      setBank((b) => ({ ...b, accountNumber: "" }));
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function changePassword() {
    setSaving(true);
    try {
      const res = await fetch("/api/profile/password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(passwords),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not change password");

      toast.success(body.message);
      setPasswords({ currentPassword: "", newPassword: "", confirmPassword: "" });

      if (body.signOutRequired) {
        setTimeout(async () => {
          await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
          router.replace("/auth/login");
        }, 1500);
      }
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  const status = employee.employment?.status ?? "active";

  return (
    <>
      <PageHeader
        title="My profile"
        description="Your record as HR holds it. Some fields you can change yourself; the rest need HR."
      />

      {/* Identity header */}
      <section className="rounded-lg border bg-surface p-4 sm:p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
          <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-muted text-lg font-semibold">
            {initialsOf(employee.displayName ?? "")}
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-semibold">{employee.displayName}</h2>
              <StatusPill tone={EMPLOYEE_STATUS_TONE[status] ?? "neutral"}>
                {STATUS_LABEL[status] ?? status}
              </StatusPill>
            </div>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {employee.designationId?.title ?? "—"}
              {employee.departmentId?.name ? ` · ${employee.departmentId.name}` : ""}
            </p>
            <p className="tabular mt-0.5 text-xs text-subtle-foreground">
              {employee.employeeCode}
            </p>
          </div>
        </div>

        <dl className="mt-5 grid grid-cols-2 gap-4 border-t pt-4 sm:grid-cols-3 lg:grid-cols-4">
          <Field label="Work email" icon={Mail} value={employee.contact?.workEmail ?? email} />
          <Field label="Phone" icon={Phone} value={employee.contact?.personalPhone} />
          <Field
            label="Joined"
            icon={CalendarDays}
            value={formatDate(employee.employment?.dateOfJoining)}
          />
          <Field
            label="Reports to"
            icon={UserCog}
            value={
              profile.manager ? (
                <>
                  {profile.manager.displayName}
                  <span className="block text-xs text-subtle-foreground">
                    {profile.manager.designation ?? profile.manager.employeeCode}
                  </span>
                </>
              ) : null
            }
          />
        </dl>
      </section>

      {/* Tabs */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div role="tablist" className="flex min-w-max gap-1 border-b">
          {TABS.map((t) => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-primary font-medium text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ---- Employment ---- */}
      {tab === "employment" ? (
        <Panel title="Employment" description="Held by HR. Raise a request if something here is wrong.">
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Field label="Employee code" value={employee.employeeCode} />
            <Field label="Designation" value={employee.designationId?.title} />
            <Field label="Department" icon={Building2} value={employee.departmentId?.name} />
            <Field label="Location" icon={MapPin} value={employee.locationId?.name} />
            <Field label="Grade" value={employee.gradeId?.name} />
            <Field label="Access role" value={role} />
            <Field label="Employment type" value={employee.employment?.employmentType} />
            <Field label="Work mode" value={employee.employment?.workMode} />
            <Field label="Date of joining" value={formatDate(employee.employment?.dateOfJoining)} />
            <Field
              label="Probation ends"
              value={formatDate(employee.employment?.probationEndDate)}
            />
            <Field label="Reporting manager" value={profile.manager?.displayName} />
          </dl>

          {profile.history?.length > 0 ? (
            <div className="mt-6 border-t pt-4">
              <p className="eyebrow mb-3">History</p>
              <ul className="space-y-2.5">
                {profile.history.map((h: any) => (
                  <li key={h._id} className="flex gap-3 text-sm">
                    <span className="tabular w-24 shrink-0 text-subtle-foreground">
                      {formatDate(h.effectiveFrom)}
                    </span>
                    <span className="text-muted-foreground">
                      {h.changeType.replace(/-/g, " ")}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </Panel>
      ) : null}

      {/* ---- Personal ---- */}
      {tab === "personal" ? (
        <div className="space-y-4">
          <Panel
            title="Personal details"
            description="These you can change yourself. Name and statutory IDs need HR."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="personalEmail">Personal email</Label>
                <Input
                  id="personalEmail"
                  type="email"
                  value={personal.personalEmail}
                  onChange={(e) => setPersonal({ ...personal, personalEmail: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="personalPhone">Phone</Label>
                <Input
                  id="personalPhone"
                  value={personal.personalPhone}
                  onChange={(e) => setPersonal({ ...personal, personalPhone: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="dob">Date of birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={personal.dateOfBirth}
                  onChange={(e) => setPersonal({ ...personal, dateOfBirth: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="marital">Marital status</Label>
                <select
                  id="marital"
                  value={personal.maritalStatus}
                  onChange={(e) => setPersonal({ ...personal, maritalStatus: e.target.value })}
                  className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
                >
                  <option value="">Not specified</option>
                  <option value="single">Single</option>
                  <option value="married">Married</option>
                  <option value="divorced">Divorced</option>
                  <option value="widowed">Widowed</option>
                  <option value="undisclosed">Prefer not to say</option>
                </select>
              </div>
              <div className="sm:col-span-2">
                <Label htmlFor="address">Current address</Label>
                <Input
                  id="address"
                  value={personal.addressLine1}
                  onChange={(e) => setPersonal({ ...personal, addressLine1: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={personal.city}
                  onChange={(e) => setPersonal({ ...personal, city: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="pincode">PIN code</Label>
                <Input
                  id="pincode"
                  value={personal.pincode}
                  onChange={(e) => setPersonal({ ...personal, pincode: e.target.value })}
                />
              </div>
            </div>
          </Panel>

          <Panel
            title="Bank details"
            description="Where your salary is credited. HR is notified whenever these change."
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label htmlFor="holder">Account holder name</Label>
                <Input
                  id="holder"
                  value={bank.accountHolderName}
                  onChange={(e) => setBank({ ...bank, accountHolderName: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="account">Account number</Label>
                <Input
                  id="account"
                  value={bank.accountNumber}
                  placeholder={employee.bank?.accountNumber ?? "Not set"}
                  onChange={(e) => setBank({ ...bank, accountNumber: e.target.value })}
                />
                <p className="mt-1 text-xs text-subtle-foreground">
                  Leave blank to keep the current account.
                </p>
              </div>
              <div>
                <Label htmlFor="ifsc">IFSC</Label>
                <Input
                  id="ifsc"
                  value={bank.ifsc}
                  onChange={(e) => setBank({ ...bank, ifsc: e.target.value.toUpperCase() })}
                />
              </div>
              <div>
                <Label htmlFor="bankName">Bank</Label>
                <Input
                  id="bankName"
                  value={bank.bankName}
                  onChange={(e) => setBank({ ...bank, bankName: e.target.value })}
                />
              </div>
            </div>
          </Panel>

          <Button onClick={savePersonal} disabled={saving}>
            <Save className="mr-2 h-4 w-4" aria-hidden />
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}

      {/* ---- Work & pay ---- */}
      {tab === "pay" ? (
        <Panel
          title="Salary structure"
          description={
            profile.salary
              ? `Effective from ${formatDate(profile.salary.effectiveFrom)}.`
              : "No structure on record yet."
          }
        >
          {!profile.salary ? (
            <EmptyState
              icon={Wallet}
              title="No salary structure"
              description="Your pay structure has not been set up yet. Payroll cannot generate a payslip for you until HR adds one."
            />
          ) : (
            <>
              <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <Field label="Annual CTC" value={formatINR(profile.salary.annualCtc)} />
                <Field label="Monthly gross" value={formatINR(profile.salary.monthlyGross)} />
                <Field label="Effective from" value={formatDate(profile.salary.effectiveFrom)} />
              </dl>

              <div className="mt-5 overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left">
                      <th className="eyebrow px-4 py-2.5 font-semibold">Component</th>
                      <th className="eyebrow px-4 py-2.5 text-right font-semibold">Monthly</th>
                      <th className="eyebrow px-4 py-2.5 text-right font-semibold">Annual</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {profile.salary.components.map((c: any) => (
                      <tr key={c.code}>
                        <td className="px-4 py-2.5">{c.name}</td>
                        <td className="tabular px-4 py-2.5 text-right">
                          {formatINR(c.monthly)}
                        </td>
                        <td className="tabular px-4 py-2.5 text-right text-muted-foreground">
                          {formatINR(c.monthly * 12)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </Panel>
      ) : null}

      {/* ---- Documents ---- */}
      {tab === "documents" ? (
        <div className="space-y-4">
          {!storageReady ? (
            <div className="flex items-start gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden />
              <p className="text-sm">
                File storage is not configured, so uploads will fail. Set the
                Cloudinary credentials in the environment.
              </p>
            </div>
          ) : null}

          <DocumentsCard
            title="My documents"
            description="Identity and qualification documents you upload. Private to you and HR."
            source="personal"
            documents={profile.documents.personal}
            categories={PERSONAL_CATEGORIES}
            employeeId={employee._id}
            canUpload
            canDelete
          />

          <DocumentsCard
            title="Issued by the company"
            description="Letters HR has issued to you. Read-only."
            source="company"
            documents={profile.documents.company}
            categories={COMPANY_CATEGORIES}
            employeeId={employee._id}
            canUpload={false}
            canDelete={false}
          />
        </div>
      ) : null}

      {/* ---- HR notices ---- */}
      {tab === "notices" ? (
        <Panel title="HR notices" description="Notices addressed to you personally.">
          {profile.notices.length === 0 ? (
            <EmptyState
              icon={Megaphone}
              title="Nothing here"
              description="Notices HR sends you directly — appreciations, memos, confirmation letters — appear here. Company-wide posts are under Announcements."
            />
          ) : (
            <ul className="space-y-3">
              {profile.notices.map((n: any) => (
                <li key={n._id} className="rounded-lg border p-4">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={NOTICE_TONE[n.type] ?? "neutral"}>{n.type}</StatusPill>
                    <span className="text-sm font-medium">{n.title}</span>
                    <span className="ml-auto text-xs text-subtle-foreground">
                      {formatDate(n.issuedAt)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{n.body}</p>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      ) : null}

      {/* ---- Security ---- */}
      {tab === "security" ? (
        <Panel
          title="Password"
          description="Changing it signs you out everywhere else, including any device you may have left signed in."
        >
          <div className="grid max-w-md gap-4">
            <div>
              <Label htmlFor="current">Current password</Label>
              <Input
                id="current"
                type="password"
                autoComplete="current-password"
                value={passwords.currentPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, currentPassword: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="new">New password</Label>
              <Input
                id="new"
                type="password"
                autoComplete="new-password"
                value={passwords.newPassword}
                onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })}
              />
              <p className="mt-1 text-xs text-subtle-foreground">At least 8 characters.</p>
            </div>
            <div>
              <Label htmlFor="confirm">Confirm new password</Label>
              <Input
                id="confirm"
                type="password"
                autoComplete="new-password"
                value={passwords.confirmPassword}
                onChange={(e) =>
                  setPasswords({ ...passwords, confirmPassword: e.target.value })
                }
              />
            </div>

            <Button onClick={changePassword} disabled={saving} className="justify-self-start">
              <KeyRound className="mr-2 h-4 w-4" aria-hidden />
              {saving ? "Changing…" : "Change password"}
            </Button>
          </div>
        </Panel>
      ) : null}
    </>
  );
}
