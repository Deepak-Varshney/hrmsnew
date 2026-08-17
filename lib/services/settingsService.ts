// lib/services/settingsService.ts
//
// Organisation settings: the profile, the statutory configuration for a
// financial year, and the master lists everything else references.
//
// Statutory rates live in the database rather than in code because the Union
// Budget moves tax slabs every February and professional tax differs in every
// state. Editing them here is the supported way to respond to that — see
// model/StatutoryConfig.ts.

import mongoose from "mongoose";
import Organization from "@/model/Organization";
import StatutoryConfig from "@/model/StatutoryConfig";
import Department from "@/model/Department";
import Designation from "@/model/Designation";
import Grade from "@/model/Grade";
import Location from "@/model/Location";
import Employee from "@/model/Employee";
import { requireOrgId } from "@/lib/context";
import { assertCan } from "@/lib/rbac";
import { logActivity } from "@/lib/activity";
import { ValidationError, ConflictError } from "@/lib/services/employee";
import { financialYearFor } from "@/lib/services/payroll";

// ---------------------------------------------------------------------------
// Masters
// ---------------------------------------------------------------------------

export type MasterKind = "department" | "designation" | "grade" | "location";

const MASTERS = {
  department: {
    model: Department,
    labelField: "name",
    employeeField: "departmentId",
  },
  designation: {
    model: Designation,
    labelField: "title",
    employeeField: "designationId",
  },
  grade: { model: Grade, labelField: "name", employeeField: "gradeId" },
  location: {
    model: Location,
    labelField: "name",
    employeeField: "locationId",
  },
} as const;

function masterFor(kind: string) {
  const entry = (MASTERS as any)[kind];
  if (!entry) throw new ValidationError(`Unknown master list "${kind}".`);
  return entry as { model: any; labelField: string; employeeField: string };
}

/** Every master list, with a headcount against each entry. */
export async function listMasters() {
  await assertCan("master.read");

  const [departments, designations, grades, locations, counts] =
    await Promise.all([
      Department.find().sort({ name: 1 }).lean(),
      Designation.find().sort({ title: 1 }).lean(),
      Grade.find().sort({ level: 1 }).lean(),
      Location.find().sort({ name: 1 }).lean(),
      Employee.aggregate([
        { $match: { "employment.status": { $ne: "exited" } } },
        {
          $facet: {
            department: [{ $group: { _id: "$departmentId", n: { $sum: 1 } } }],
            designation: [
              { $group: { _id: "$designationId", n: { $sum: 1 } } },
            ],
            grade: [{ $group: { _id: "$gradeId", n: { $sum: 1 } } }],
            location: [{ $group: { _id: "$locationId", n: { $sum: 1 } } }],
          },
        },
      ]),
    ]);

  const facet = counts[0] ?? {};
  const countMap = (key: string) =>
    new Map<string, number>(
      (facet[key] ?? [])
        .filter((r: any) => r._id)
        .map((r: any) => [String(r._id), r.n]),
    );

  const deptCounts = countMap("department");
  const desigCounts = countMap("designation");
  const gradeCounts = countMap("grade");
  const locCounts = countMap("location");

  const shape = (
    rows: any[],
    labelField: string,
    counts: Map<string, number>,
  ) =>
    rows.map((r) => ({
      id: String(r._id),
      label: r[labelField],
      code: r.code,
      level: r.level ?? null,
      type: r.type ?? null,
      isActive: r.isActive !== false,
      employees: counts.get(String(r._id)) ?? 0,
    }));

  return {
    department: shape(departments, "name", deptCounts),
    designation: shape(designations, "title", desigCounts),
    grade: shape(grades, "name", gradeCounts),
    location: shape(locations, "name", locCounts),
  };
}

export async function createMaster(
  kind: string,
  input: { label?: string; code?: string; level?: number; type?: string },
) {
  await assertCan("master.write");
  const { model, labelField } = masterFor(kind);
  const orgId = requireOrgId();

  const label = input.label?.trim();
  const code = input.code?.trim().toUpperCase();
  if (!label) throw new ValidationError("A name is required.");
  if (!code) throw new ValidationError("A code is required.");

  const clash = await model.findOne({ code });
  if (clash) throw new ConflictError(`Code "${code}" is already in use.`);

  const doc = await model.create({
    orgId,
    [labelField]: label,
    code,
    ...(kind === "grade" ? { level: input.level ?? 1 } : {}),
    ...(kind === "location" ? { type: input.type ?? "branch" } : {}),
  });

  return { id: String(doc._id), label, code };
}

export async function updateMaster(
  kind: string,
  id: string,
  input: { label?: string; code?: string; level?: number; isActive?: boolean },
) {
  await assertCan("master.write");
  const { model, labelField } = masterFor(kind);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError("That is not a valid id.");
  }

  const doc = await model.findById(id);
  if (!doc) throw new ValidationError("Not found.");

  if (input.label?.trim()) doc[labelField] = input.label.trim();
  if (input.code?.trim()) {
    const code = input.code.trim().toUpperCase();
    const clash = await model.findOne({ code, _id: { $ne: doc._id } });
    if (clash) throw new ConflictError(`Code "${code}" is already in use.`);
    doc.code = code;
  }
  if (typeof input.level === "number") doc.level = input.level;
  if (typeof input.isActive === "boolean") doc.isActive = input.isActive;

  await doc.save();
  return { id: String(doc._id), label: doc[labelField], code: doc.code };
}

/**
 * Soft-deletes a master entry.
 *
 * Blocked while employees still point at it: the alternative is a roster full
 * of blank departments, and nothing in the UI would explain why.
 */
export async function deleteMaster(kind: string, id: string) {
  await assertCan("master.write");
  const { model, labelField, employeeField } = masterFor(kind);

  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw new ValidationError("That is not a valid id.");
  }

  const doc = await model.findById(id);
  if (!doc) throw new ValidationError("Not found.");

  const inUse = await Employee.countDocuments({
    [employeeField]: doc._id,
    "employment.status": { $ne: "exited" },
  });

  if (inUse > 0) {
    throw new ConflictError(
      `${inUse} ${inUse === 1 ? "employee is" : "employees are"} still assigned to "${doc[labelField]}". Move them first, or deactivate it instead.`,
    );
  }

  await doc.softDelete();
  return { label: doc[labelField] };
}

// ---------------------------------------------------------------------------
// Organisation profile
// ---------------------------------------------------------------------------

const PROFILE_FIELDS = [
  "name",
  "legalName",
  "logo",
  "timezone",
  "fiscalYearStartMonth",
  "employeeCodePrefix",
] as const;

export async function updateOrgProfile(input: Record<string, any>) {
  await assertCan("org.settings");
  const orgId = requireOrgId();

  const org = await Organization.findById(orgId);
  if (!org) throw new ValidationError("Organisation not found.");

  for (const field of PROFILE_FIELDS) {
    if (input[field] === undefined) continue;
    (org as any)[field] = input[field];
  }

  if (input.contact) {
    org.contact = { ...(org.contact ?? {}), ...input.contact };
  }
  if (input.address) {
    org.address = { ...(org.address ?? {}), ...input.address };
  }
  if (input.statutory) {
    // Registration identifiers, not rates — the rates live on StatutoryConfig.
    org.statutory = { ...(org.statutory ?? {}), ...input.statutory };
  }

  if (!org.name?.trim())
    throw new ValidationError("The organisation needs a name.");

  await org.save();

  // The slug is deliberately not editable here: it is the tenant key in every
  // saved link and bookmark, and changing it breaks them silently.
  return { id: String(org._id), name: org.name, slug: org.slug };
}

// ---------------------------------------------------------------------------
// Statutory configuration
// ---------------------------------------------------------------------------

/** The config for a financial year, created from defaults if absent. */
export async function loadStatutoryConfig(financialYear?: string) {
  await assertCan("org.settings");
  const orgId = requireOrgId();
  const fy = financialYear?.trim() || financialYearFor(new Date());

  let config = await StatutoryConfig.findOne({ financialYear: fy });
  if (!config) {
    config = await StatutoryConfig.create({ orgId, financialYear: fy });
  }

  return JSON.parse(JSON.stringify(config.toObject()));
}

const STATUTORY_SECTIONS = [
  "pf",
  "esi",
  "professionalTax",
  "incomeTax",
  "lwf",
  "gratuity",
] as const;

export async function updateStatutoryConfig(
  financialYear: string,
  input: Record<string, any>,
) {
  await assertCan("org.settings");
  const orgId = requireOrgId();

  const fy = financialYear?.trim();
  if (!fy) throw new ValidationError("A financial year is required.");

  let config = await StatutoryConfig.findOne({ financialYear: fy });
  if (!config)
    config = await StatutoryConfig.create({ orgId, financialYear: fy });

  for (const section of STATUTORY_SECTIONS) {
    if (!input[section]) continue;
    (config as any)[section] = {
      ...((config as any)[section].toObject?.() ?? (config as any)[section]),
      ...input[section],
    };
  }

  // Slabs must not overlap or leave a gap, or an employee's gross could land
  // in two brackets at once — or in none, which silently deducts nothing.
  assertSlabsContiguous(
    config.professionalTax?.slabs ?? [],
    "Professional tax",
  );
  assertSlabsContiguous(config.incomeTax?.newRegimeSlabs ?? [], "New regime");
  assertSlabsContiguous(config.incomeTax?.oldRegimeSlabs ?? [], "Old regime");

  await config.save();

  await logActivity({
    action: "statutory.updated",
    entityType: "StatutoryConfig",
    entityId: config._id,
    entityLabel: `Statutory config FY ${fy}`,
    orgId: new mongoose.Types.ObjectId(orgId),
    severity: "critical",
    metadata: { sections: STATUTORY_SECTIONS.filter((s) => input[s]) },
  });

  return JSON.parse(JSON.stringify(config.toObject()));
}

function assertSlabsContiguous(
  slabs: Array<{ from: number; to: number | null }>,
  label: string,
) {
  if (slabs.length === 0) return;

  const sorted = [...slabs].sort((a, b) => a.from - b.from);

  if (sorted[0].from !== 0) {
    throw new ValidationError(`${label} slabs must start at zero.`);
  }

  for (let i = 0; i < sorted.length - 1; i++) {
    const upper = sorted[i].to;
    const nextFrom = sorted[i + 1].from;

    if (upper === null || upper === undefined) {
      throw new ValidationError(
        `${label}: only the last slab may be open-ended.`,
      );
    }

    // Two boundary conventions are in use and both are correct. Income tax
    // slabs share the boundary (0–4L, then 4L–8L); professional tax excludes
    // it (0–24,999, then 25,000–). So the next slab may start either exactly
    // at this one's upper bound or one paisa above it. Anything else is a
    // genuine overlap or a genuine gap.
    if (nextFrom < upper) {
      throw new ValidationError(
        `${label} slabs overlap around ₹${(upper / 100).toLocaleString("en-IN")}.`,
      );
    }
    if (nextFrom > upper + 1) {
      throw new ValidationError(
        `${label} slabs leave a gap above ₹${(upper / 100).toLocaleString("en-IN")}.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------

/** Everything the settings page renders, in one pass. */
export async function loadSettingsPage() {
  await assertCan("org.settings");
  const orgId = requireOrgId();

  const [org, masters, statutory] = await Promise.all([
    Organization.findById(orgId).lean(),
    listMasters(),
    loadStatutoryConfig(),
  ]);

  if (!org) throw new ValidationError("Organisation not found.");

  return {
    org: JSON.parse(JSON.stringify(org)),
    masters,
    statutory,
    financialYear: statutory.financialYear,
  };
}
