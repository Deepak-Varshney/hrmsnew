"use client";

// Organisation settings.
//
// Three tabs, all rendered from data the server already loaded: the profile,
// the statutory rates payroll runs against, and the master lists everything
// else picks from.

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2, Building2, Landmark, ListTree } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusPill } from "@/components/ui/status-pill";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

interface MasterItem {
  id: string;
  label: string;
  code: string;
  level: number | null;
  type: string | null;
  isActive: boolean;
  employees: number;
}

type Masters = Record<
  "department" | "designation" | "grade" | "location",
  MasterItem[]
>;

/** Paise in the database, rupees in the input. */
const toRupees = (paise: number | null | undefined) =>
  paise === null || paise === undefined ? "" : String(paise / 100);
const toPaise = (rupees: string) => Math.round(Number(rupees || 0) * 100);

export function SettingsClient({
  org,
  masters,
  statutory,
  canEdit,
}: {
  org: any;
  masters: Masters;
  statutory: any;
  canEdit: boolean;
}) {
  return (
    <>
      <PageHeader
        title="Settings"
        description={`How ${org.name} is configured. Statutory rates here decide what everyone is paid.`}
      />

      <Tabs defaultValue="organisation">
        <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          <TabsList>
            <TabsTrigger value="organisation">
              <Building2 className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Organisation
            </TabsTrigger>
            <TabsTrigger value="statutory">
              <Landmark className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Statutory
            </TabsTrigger>
            <TabsTrigger value="masters">
              <ListTree className="mr-1.5 h-3.5 w-3.5" aria-hidden />
              Master data
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="organisation" className="mt-4">
          <OrganisationTab org={org} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="statutory" className="mt-4">
          <StatutoryTab statutory={statutory} canEdit={canEdit} />
        </TabsContent>

        <TabsContent value="masters" className="mt-4">
          <MastersTab masters={masters} canEdit={canEdit} />
        </TabsContent>
      </Tabs>
    </>
  );
}

// ---------------------------------------------------------------------------

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
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
      {hint ? <p className="text-xs text-subtle-foreground">{hint}</p> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function OrganisationTab({ org, canEdit }: { org: any; canEdit: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();
  const [form, setForm] = useState({
    name: org.name ?? "",
    legalName: org.legalName ?? "",
    employeeCodePrefix: org.employeeCodePrefix ?? "EMP",
    fiscalYearStartMonth: org.fiscalYearStartMonth ?? 4,
    timezone: org.timezone ?? "Asia/Kolkata",
    contactEmail: org.contact?.email ?? "",
    contactPhone: org.contact?.phone ?? "",
    line1: org.address?.line1 ?? "",
    city: org.address?.city ?? "",
    state: org.address?.state ?? "",
    pincode: org.address?.pincode ?? "",
    pan: org.statutory?.pan ?? "",
    tan: org.statutory?.tan ?? "",
    gstin: org.statutory?.gstin ?? "",
    pfCode: org.statutory?.pfCode ?? "",
    esicCode: org.statutory?.esicCode ?? "",
  });

  const set = (key: string, value: any) =>
    setForm((f) => ({ ...f, [key]: value }));

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          legalName: form.legalName,
          employeeCodePrefix: form.employeeCodePrefix,
          fiscalYearStartMonth: Number(form.fiscalYearStartMonth),
          timezone: form.timezone,
          contact: { email: form.contactEmail, phone: form.contactPhone },
          address: {
            line1: form.line1,
            city: form.city,
            state: form.state,
            pincode: form.pincode,
          },
          statutory: {
            pan: form.pan,
            tan: form.tan,
            gstin: form.gstin,
            pfCode: form.pfCode,
            esicCode: form.esicCode,
          },
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not save");
      toast.success(result.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <Section title="Identity">
        <Field label="Display name">
          <Input
            value={form.name}
            onChange={(e) => set("name", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Legal name" hint="As registered. Used on payslips.">
          <Input
            value={form.legalName}
            onChange={(e) => set("legalName", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="URL key"
          hint="Fixed. Every saved link points at it, so it cannot be edited here."
        >
          <Input value={`/${org.slug}`} disabled readOnly />
        </Field>
        <Field
          label="Employee code prefix"
          hint="New employee codes start with this."
        >
          <Input
            value={form.employeeCodePrefix}
            onChange={(e) =>
              set("employeeCodePrefix", e.target.value.toUpperCase())
            }
            disabled={!canEdit}
          />
        </Field>
      </Section>

      <Section title="Contact">
        <Field label="HR email">
          <Input
            type="email"
            value={form.contactEmail}
            onChange={(e) => set("contactEmail", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Phone">
          <Input
            value={form.contactPhone}
            onChange={(e) => set("contactPhone", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Address">
          <Input
            value={form.line1}
            onChange={(e) => set("line1", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label="City">
          <Input
            value={form.city}
            onChange={(e) => set("city", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="State"
          hint="Professional tax and LWF are decided by this."
        >
          <Input
            value={form.state}
            onChange={(e) => set("state", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label="PIN code">
          <Input
            value={form.pincode}
            onChange={(e) => set("pincode", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </Section>

      <Section
        title="Registration"
        hint="Statutory identifiers that appear on returns and payslips."
      >
        <Field label="PAN">
          <Input
            value={form.pan}
            onChange={(e) => set("pan", e.target.value.toUpperCase())}
            disabled={!canEdit}
          />
        </Field>
        <Field label="TAN" hint="Required to file TDS returns.">
          <Input
            value={form.tan}
            onChange={(e) => set("tan", e.target.value.toUpperCase())}
            disabled={!canEdit}
          />
        </Field>
        <Field label="GSTIN">
          <Input
            value={form.gstin}
            onChange={(e) => set("gstin", e.target.value.toUpperCase())}
            disabled={!canEdit}
          />
        </Field>
        <Field label="PF establishment code">
          <Input
            value={form.pfCode}
            onChange={(e) => set("pfCode", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
        <Field label="ESIC code">
          <Input
            value={form.esicCode}
            onChange={(e) => set("esicCode", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </Section>

      <Section title="Financial year">
        <Field
          label="Starts in"
          hint="April in India. Payroll periods and FY labels follow this."
        >
          <select
            value={form.fiscalYearStartMonth}
            onChange={(e) => set("fiscalYearStartMonth", e.target.value)}
            disabled={!canEdit}
            className="h-9 w-full rounded-md border bg-surface px-3 text-sm disabled:opacity-60"
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Timezone">
          <Input
            value={form.timezone}
            onChange={(e) => set("timezone", e.target.value)}
            disabled={!canEdit}
          />
        </Field>
      </Section>

      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function StatutoryTab({
  statutory,
  canEdit,
}: {
  statutory: any;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [, startTransition] = useTransition();

  const [pf, setPf] = useState({ ...statutory.pf });
  const [esi, setEsi] = useState({ ...statutory.esi });
  const [pt, setPt] = useState({ ...statutory.professionalTax });
  const [lwf, setLwf] = useState({ ...statutory.lwf });
  const [gratuity, setGratuity] = useState({ ...statutory.gratuity });

  async function save() {
    setSaving(true);
    try {
      const res = await fetch("/api/settings/statutory", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          financialYear: statutory.financialYear,
          pf,
          esi,
          professionalTax: pt,
          lwf,
          gratuity,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not save");
      toast.success(result.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm">
        <p className="font-medium text-warning">
          These numbers decide what people are paid.
        </p>
        <p className="mt-1 text-muted-foreground">
          Editing them affects every payroll run computed afterwards, and each
          change is recorded in the activity log. The values shipped with this
          system are illustrative — have a practising CA confirm them against
          the current Finance Act and your state notification before you run
          live payroll.
        </p>
      </div>

      <p className="text-sm text-muted-foreground">
        Financial year{" "}
        <span className="font-medium text-foreground">
          {statutory.financialYear}
        </span>
      </p>

      <Section title="Provident Fund">
        <Field label="Enabled">
          <Toggle
            checked={pf.enabled}
            onChange={(v) => setPf({ ...pf, enabled: v })}
            disabled={!canEdit}
            label="Deduct PF"
          />
        </Field>
        <Field label="Employee rate (%)">
          <Input
            type="number"
            step="0.01"
            value={pf.employeeRate}
            onChange={(e) =>
              setPf({ ...pf, employeeRate: Number(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field label="Employer rate (%)">
          <Input
            type="number"
            step="0.01"
            value={pf.employerRate}
            onChange={(e) =>
              setPf({ ...pf, employerRate: Number(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="Pension (EPS) rate (%)"
          hint="Part of the employer share, capped at the wage ceiling."
        >
          <Input
            type="number"
            step="0.01"
            value={pf.epsRate}
            onChange={(e) => setPf({ ...pf, epsRate: Number(e.target.value) })}
            disabled={!canEdit}
          />
        </Field>
        <Field label="Monthly wage ceiling (₹)">
          <Input
            type="number"
            value={toRupees(pf.wageCeiling)}
            onChange={(e) =>
              setPf({ ...pf, wageCeiling: toPaise(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="Restrict to ceiling"
          hint="Off means contributions compute on actual basic."
        >
          <Toggle
            checked={pf.restrictToCeiling}
            onChange={(v) => setPf({ ...pf, restrictToCeiling: v })}
            disabled={!canEdit}
            label="Cap at the ceiling"
          />
        </Field>
      </Section>

      <Section title="ESI">
        <Field label="Enabled">
          <Toggle
            checked={esi.enabled}
            onChange={(v) => setEsi({ ...esi, enabled: v })}
            disabled={!canEdit}
            label="Deduct ESI"
          />
        </Field>
        <Field
          label="Gross threshold (₹)"
          hint="ESI applies at or below this monthly gross."
        >
          <Input
            type="number"
            value={toRupees(esi.grossThreshold)}
            onChange={(e) =>
              setEsi({ ...esi, grossThreshold: toPaise(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field label="Employee rate (%)">
          <Input
            type="number"
            step="0.01"
            value={esi.employeeRate}
            onChange={(e) =>
              setEsi({ ...esi, employeeRate: Number(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field label="Employer rate (%)">
          <Input
            type="number"
            step="0.01"
            value={esi.employerRate}
            onChange={(e) =>
              setEsi({ ...esi, employerRate: Number(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
      </Section>

      <section className="rounded-lg border bg-surface p-5">
        <h2 className="text-sm font-semibold">Professional tax</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Set by the state, not the centre. Slabs must run from zero without a
          gap or an overlap — only the last one may be open-ended.
        </p>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <Field label="Enabled" hint="Some states levy none at all.">
            <Toggle
              checked={pt.enabled}
              onChange={(v) => setPt({ ...pt, enabled: v })}
              disabled={!canEdit}
              label="Deduct professional tax"
            />
          </Field>
          <Field label="State">
            <Input
              value={pt.state ?? ""}
              onChange={(e) => setPt({ ...pt, state: e.target.value })}
              disabled={!canEdit}
            />
          </Field>
        </div>

        <SlabEditor
          slabs={pt.slabs ?? []}
          onChange={(slabs) => setPt({ ...pt, slabs })}
          valueLabel="Monthly tax (₹)"
          valueKey="amount"
          disabled={!canEdit}
        />
      </section>

      <Section title="Labour Welfare Fund">
        <Field label="Enabled">
          <Toggle
            checked={lwf.enabled}
            onChange={(v) => setLwf({ ...lwf, enabled: v })}
            disabled={!canEdit}
            label="Deduct LWF"
          />
        </Field>
        <Field label="Employee share (₹)">
          <Input
            type="number"
            value={toRupees(lwf.employeeAmount)}
            onChange={(e) =>
              setLwf({ ...lwf, employeeAmount: toPaise(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field label="Employer share (₹)">
          <Input
            type="number"
            value={toRupees(lwf.employerAmount)}
            onChange={(e) =>
              setLwf({ ...lwf, employerAmount: toPaise(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="Deducted in months"
          hint="Comma-separated month numbers. Most states deduct half-yearly or annually, not monthly."
        >
          <Input
            value={(lwf.deductionMonths ?? []).join(", ")}
            onChange={(e) =>
              setLwf({
                ...lwf,
                deductionMonths: e.target.value
                  .split(",")
                  .map((s) => Number(s.trim()))
                  .filter((n) => n >= 1 && n <= 12),
              })
            }
            disabled={!canEdit}
          />
        </Field>
      </Section>

      <Section title="Gratuity">
        <Field label="Enabled">
          <Toggle
            checked={gratuity.enabled}
            onChange={(v) => setGratuity({ ...gratuity, enabled: v })}
            disabled={!canEdit}
            label="Accrue gratuity"
          />
        </Field>
        <Field label="Minimum years of service">
          <Input
            type="number"
            value={gratuity.minimumYears}
            onChange={(e) =>
              setGratuity({ ...gratuity, minimumYears: Number(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field
          label="Days per completed year"
          hint="The Act's formula is 15 days' wages over a 26-day month."
        >
          <Input
            type="number"
            value={gratuity.daysPerYear}
            onChange={(e) =>
              setGratuity({ ...gratuity, daysPerYear: Number(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
        <Field label="Statutory cap (₹)">
          <Input
            type="number"
            value={toRupees(gratuity.cap)}
            onChange={(e) =>
              setGratuity({ ...gratuity, cap: toPaise(e.target.value) })
            }
            disabled={!canEdit}
          />
        </Field>
      </Section>

      {canEdit ? (
        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            {saving ? "Saving…" : "Save statutory settings"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function SlabEditor({
  slabs,
  onChange,
  valueLabel,
  valueKey,
  disabled,
}: {
  slabs: any[];
  onChange: (slabs: any[]) => void;
  valueLabel: string;
  valueKey: string;
  disabled: boolean;
}) {
  const update = (i: number, key: string, value: any) => {
    const next = slabs.map((s, idx) =>
      idx === i ? { ...s, [key]: value } : s,
    );
    onChange(next);
  };

  return (
    <div className="mt-4">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="eyebrow py-2 font-semibold">From (₹)</th>
              <th className="eyebrow py-2 font-semibold">To (₹)</th>
              <th className="eyebrow py-2 font-semibold">{valueLabel}</th>
              <th className="w-10" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {slabs.map((slab, i) => (
              <tr key={i}>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    value={toRupees(slab.from)}
                    onChange={(e) => update(i, "from", toPaise(e.target.value))}
                    disabled={disabled}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    placeholder="No limit"
                    value={slab.to === null ? "" : toRupees(slab.to)}
                    onChange={(e) =>
                      update(
                        i,
                        "to",
                        e.target.value === "" ? null : toPaise(e.target.value),
                      )
                    }
                    disabled={disabled}
                  />
                </td>
                <td className="py-2 pr-2">
                  <Input
                    type="number"
                    value={toRupees(slab[valueKey])}
                    onChange={(e) =>
                      update(i, valueKey, toPaise(e.target.value))
                    }
                    disabled={disabled}
                  />
                </td>
                <td className="py-2">
                  {disabled ? null : (
                    <button
                      type="button"
                      onClick={() =>
                        onChange(slabs.filter((_, idx) => idx !== i))
                      }
                      aria-label="Remove slab"
                      className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-danger/10 hover:text-danger"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {disabled ? null : (
        <Button
          size="sm"
          variant="outline"
          className="mt-3"
          onClick={() =>
            onChange([
              ...slabs,
              {
                from: slabs.length ? (slabs[slabs.length - 1].to ?? 0) + 1 : 0,
                to: null,
                [valueKey]: 0,
              },
            ])
          }
        >
          <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
          Add slab
        </Button>
      )}
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className="flex h-9 items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={Boolean(checked)}
        onChange={(e) => onChange(e.target.checked)}
        disabled={disabled}
        className="h-4 w-4 rounded border-border accent-primary"
      />
      <span className={disabled ? "text-muted-foreground" : ""}>{label}</span>
    </label>
  );
}

// ---------------------------------------------------------------------------

const MASTER_TABS: Array<{ kind: keyof Masters; label: string; noun: string }> =
  [
    { kind: "department", label: "Departments", noun: "department" },
    { kind: "designation", label: "Designations", noun: "designation" },
    { kind: "grade", label: "Grades", noun: "grade" },
    { kind: "location", label: "Locations", noun: "location" },
  ];

function MastersTab({
  masters,
  canEdit,
}: {
  masters: Masters;
  canEdit: boolean;
}) {
  const router = useRouter();
  const [kind, setKind] = useState<keyof Masters>("department");
  const [busy, setBusy] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newCode, setNewCode] = useState("");
  const [, startTransition] = useTransition();

  const items = masters[kind] ?? [];
  const noun = MASTER_TABS.find((t) => t.kind === kind)!.noun;

  async function call(method: string, body: Record<string, any>) {
    setBusy(true);
    try {
      const res = await fetch("/api/settings/masters", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, ...body }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "That did not work");
      toast.success(result.message);
      startTransition(() => router.refresh());
      return true;
    } catch (err: any) {
      toast.error(err.message);
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    if (!newLabel.trim() || !newCode.trim()) {
      toast.error("A name and a code are both required.");
      return;
    }
    const ok = await call("POST", { label: newLabel, code: newCode });
    if (ok) {
      setNewLabel("");
      setNewCode("");
    }
  }

  return (
    <div className="space-y-4">
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <div className="flex min-w-max gap-1 border-b">
          {MASTER_TABS.map((t) => (
            <button
              key={t.kind}
              type="button"
              onClick={() => setKind(t.kind)}
              className={`whitespace-nowrap border-b-2 px-3 py-2.5 text-sm transition-colors ${
                kind === t.kind
                  ? "border-primary font-medium text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
              <span className="ml-1.5 text-xs text-subtle-foreground">
                {masters[t.kind]?.length ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {canEdit ? (
        <div className="flex flex-wrap items-end gap-2 rounded-lg border bg-surface p-4">
          <div className="min-w-[12rem] flex-1 space-y-1.5">
            <Label>New {noun}</Label>
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder="Name"
            />
          </div>
          <div className="w-32 space-y-1.5">
            <Label>Code</Label>
            <Input
              value={newCode}
              onChange={(e) => setNewCode(e.target.value.toUpperCase())}
              placeholder="ENG"
            />
          </div>
          <Button onClick={add} disabled={busy}>
            <Plus className="mr-1.5 h-3.5 w-3.5" aria-hidden />
            Add
          </Button>
        </div>
      ) : null}

      <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
        {items.length === 0 ? (
          <li className="p-6 text-center text-sm text-muted-foreground">
            No {noun}s yet.
          </li>
        ) : (
          items.map((item) => (
            <li key={item.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  {item.label}
                  <StatusPill tone="neutral" dot={false}>
                    {item.code}
                  </StatusPill>
                  {!item.isActive ? (
                    <StatusPill tone="warning">Inactive</StatusPill>
                  ) : null}
                </p>
                <p className="mt-0.5 text-xs text-subtle-foreground">
                  {item.employees === 0
                    ? "No one assigned"
                    : `${item.employees} ${item.employees === 1 ? "person" : "people"}`}
                </p>
              </div>

              {canEdit ? (
                <div className="flex shrink-0 gap-2">
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() =>
                      call("PATCH", { id: item.id, isActive: !item.isActive })
                    }
                  >
                    {item.isActive ? "Deactivate" : "Reactivate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => call("DELETE", { id: item.id })}
                    className="text-danger hover:bg-danger/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    <span className="sr-only">Delete {item.label}</span>
                  </Button>
                </div>
              ) : null}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
