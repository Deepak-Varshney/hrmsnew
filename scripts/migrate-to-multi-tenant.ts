// scripts/migrate-to-multi-tenant.ts
//
// One-time migration from the single-tenant schema to multi-tenant.
//
//   npm run migrate:multi-tenant -- --dry-run     inspect, change nothing
//   npm run migrate:multi-tenant                  apply
//
// Organization name/slug come from ORG_NAME / ORG_SLUG, defaulting to
// "Default Organization" / "default".
//
// What it does:
//   1. Creates the Organization every existing record will belong to
//   2. Creates a Membership per User, mapping legacy roles
//      (HR/Admin → ADMIN, Manager → MANAGER, Employee → EMPLOYEE)
//   3. Creates Department and Designation masters from the distinct strings
//      currently stored on Employee documents
//   4. Reshapes Employee documents into the new nested schema
//   5. Backfills Employee.reportsTo from the legacy managerId, which points
//      at User rather than Employee
//   6. Stamps orgId onto every legacy collection
//   7. Writes a "joined" EmploymentHistory row per employee
//
// Idempotent — safe to re-run. Writes go through the raw driver so that
// legacy documents are not rejected by the new schema's validation while
// they are still being reshaped.

import "dotenv/config";
import mongoose from "mongoose";
import { connect } from "../lib/mongoose";
import { runAsSystem } from "../lib/context";

import Organization from "../model/Organization";
import Membership from "../model/Membership";
import User from "../model/User";
import Employee from "../model/Employee";
import Department from "../model/Department";
import Designation from "../model/Designation";
import EmploymentHistory from "../model/EmploymentHistory";

const DRY_RUN = process.argv.includes("--dry-run");

const ROLE_MAP: Record<string, "ADMIN" | "MANAGER" | "EMPLOYEE"> = {
  Admin: "ADMIN",
  HR: "ADMIN",
  Manager: "MANAGER",
  Employee: "EMPLOYEE",
};

/** Legacy collections that simply need an orgId stamped on every document. */
const COLLECTIONS_TO_STAMP = [
  "attendances",
  "leaves",
  "leavebalances",
  "policies",
  "announcements",
  "regularisations",
  "settings",
  "auditlogs",
];

function log(step: string, message: string) {
  console.log(`  ${step.padEnd(12)} ${message}`);
}

function splitName(full?: string): { firstName: string; lastName?: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { firstName: "Unknown" };
  if (parts.length === 1) return { firstName: parts[0] };
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

function slugifyCode(value: string, fallback: string): string {
  const code = value
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 20);
  return code || fallback;
}

async function ensureOrganization() {
  const name = process.env.ORG_NAME?.trim() || "Default Organization";
  const slug = (process.env.ORG_SLUG?.trim() || "default").toLowerCase();

  const existing = await Organization.findOne({ slug }).lean();
  if (existing) {
    log("org", `using existing "${name}" (${slug}) → ${(existing as any)._id}`);
    return existing as any;
  }

  if (DRY_RUN) {
    log("org", `would create "${name}" (${slug})`);
    return { _id: new mongoose.Types.ObjectId(), name, slug };
  }

  const org = await Organization.create({
    name,
    slug,
    status: "active",
    employeeCodePrefix: "EMP",
  });
  log("org", `created "${name}" (${slug}) → ${org._id}`);
  return org.toObject();
}

async function migrateMemberships(orgId: mongoose.Types.ObjectId) {
  const users = await User.find({ isSuperAdmin: { $ne: true } })
    .select("_id name email role")
    .lean();

  let created = 0;
  let skipped = 0;

  for (const u of users as any[]) {
    const existing = await Membership.findOne({ userId: u._id, orgId }).lean();
    if (existing) {
      skipped++;
      continue;
    }

    const role = ROLE_MAP[u.role ?? "Employee"] ?? "EMPLOYEE";

    if (!DRY_RUN) {
      await Membership.create({
        userId: u._id,
        orgId,
        role,
        status: "active",
        joinedAt: new Date(),
      });
    }
    created++;
  }

  log(
    "memberships",
    `${DRY_RUN ? "would create" : "created"} ${created}, already present ${skipped}`
  );
}

/**
 * Legacy Employee stored department and designation as free text. Turn the
 * distinct values into real master records and return lookup maps.
 */
async function createMasters(orgId: mongoose.Types.ObjectId) {
  const db = mongoose.connection.db!;
  const raw = db.collection(Employee.collection.name);

  const departments: string[] = (await raw.distinct("department", {})).filter(
    (d: any): d is string => typeof d === "string" && d.trim().length > 0
  );
  const designations: string[] = (await raw.distinct("designation", {})).filter(
    (d: any): d is string => typeof d === "string" && d.trim().length > 0
  );

  const deptMap = new Map<string, mongoose.Types.ObjectId>();
  const desigMap = new Map<string, mongoose.Types.ObjectId>();

  for (const [i, name] of departments.entries()) {
    const code = slugifyCode(name, `DEPT${i + 1}`);
    let doc = await Department.findOne({ orgId, name }).lean();
    if (!doc && !DRY_RUN) {
      doc = (await Department.create({ orgId, name, code })).toObject();
    }
    if (doc) deptMap.set(name, (doc as any)._id);
  }

  for (const [i, title] of designations.entries()) {
    const code = slugifyCode(title, `DESIG${i + 1}`);
    let doc = await Designation.findOne({ orgId, title }).lean();
    if (!doc && !DRY_RUN) {
      doc = (await Designation.create({ orgId, title, code })).toObject();
    }
    if (doc) desigMap.set(title, (doc as any)._id);
  }

  log(
    "masters",
    `${departments.length} departments, ${designations.length} designations`
  );
  return { deptMap, desigMap };
}

async function migrateEmployees(
  orgId: mongoose.Types.ObjectId,
  deptMap: Map<string, mongoose.Types.ObjectId>,
  desigMap: Map<string, mongoose.Types.ObjectId>
) {
  const db = mongoose.connection.db!;
  const raw = db.collection(Employee.collection.name);

  const legacy = await raw.find({}).toArray();
  const users = await User.find({}).select("_id name email createdAt").lean();
  const userById = new Map(users.map((u: any) => [String(u._id), u]));

  let seq = 0;
  let migrated = 0;
  let alreadyDone = 0;

  for (const doc of legacy) {
    // Already reshaped on a previous run.
    if (doc.firstName && doc.employment?.dateOfJoining) {
      alreadyDone++;
      continue;
    }

    const user = doc.userId ? userById.get(String(doc.userId)) : null;
    const { firstName, lastName } = splitName(user?.name);

    seq += 1;
    const employeeCode: string =
      doc.employeeCode?.trim() || `EMP${String(seq).padStart(4, "0")}`;

    const dateOfJoining =
      doc.joiningDate ?? user?.createdAt ?? doc.createdAt ?? new Date();

    const update: Record<string, any> = {
      orgId,
      employeeCode: employeeCode.toUpperCase(),
      firstName,
      lastName,
      displayName: user?.name ?? firstName,

      contact: {
        workEmail: user?.email ?? null,
        personalPhone: doc.phone ?? null,
        currentAddress: doc.address ? { line1: doc.address } : undefined,
      },

      employment: {
        dateOfJoining,
        probationMonths: 6,
        employmentType: "full-time",
        workMode: "onsite",
        status: "active",
      },

      departmentId: doc.department ? deptMap.get(doc.department) ?? null : null,
      designationId: doc.designation ? desigMap.get(doc.designation) ?? null : null,

      deletedAt: null,
    };

    // emergencyContact (singular, `relation`) → emergencyContacts[] (`relationship`)
    if (doc.emergencyContact?.name) {
      update.emergencyContacts = [
        {
          name: doc.emergencyContact.name,
          relationship: doc.emergencyContact.relation ?? null,
          phone: doc.emergencyContact.phone ?? null,
          isPrimary: true,
        },
      ];
    }

    if (!DRY_RUN) {
      await raw.updateOne({ _id: doc._id }, { $set: update });
    }
    migrated++;
  }

  log(
    "employees",
    `${DRY_RUN ? "would migrate" : "migrated"} ${migrated}, already migrated ${alreadyDone}`
  );
}

/**
 * Legacy managerId points at a User. The org chart walks Employee.reportsTo,
 * so translate User → Employee.
 */
async function backfillReportsTo(orgId: mongoose.Types.ObjectId) {
  const db = mongoose.connection.db!;
  const raw = db.collection(Employee.collection.name);

  const all = await raw.find({}).toArray();
  const employeeByUserId = new Map(
    all.filter((e) => e.userId).map((e) => [String(e.userId), e._id])
  );

  let linked = 0;
  let unresolved = 0;

  for (const doc of all) {
    if (!doc.managerId || doc.reportsTo) continue;

    const managerEmployeeId = employeeByUserId.get(String(doc.managerId));
    if (!managerEmployeeId) {
      unresolved++;
      continue;
    }
    if (String(managerEmployeeId) === String(doc._id)) continue; // self-reference

    if (!DRY_RUN) {
      await raw.updateOne({ _id: doc._id }, { $set: { reportsTo: managerEmployeeId } });
    }
    linked++;
  }

  log(
    "reportsTo",
    `${DRY_RUN ? "would link" : "linked"} ${linked}` +
      (unresolved ? `, ${unresolved} manager(s) had no employee record` : "")
  );
}

async function stampOrgId(orgId: mongoose.Types.ObjectId) {
  const db = mongoose.connection.db!;
  const existing = new Set(
    (await db.listCollections().toArray()).map((c) => c.name)
  );

  for (const name of COLLECTIONS_TO_STAMP) {
    if (!existing.has(name)) continue;

    const collection = db.collection(name);
    const missing = await collection.countDocuments({ orgId: { $exists: false } });
    if (missing === 0) {
      log("stamp", `${name}: already stamped`);
      continue;
    }

    if (!DRY_RUN) {
      await collection.updateMany(
        { orgId: { $exists: false } },
        { $set: { orgId, deletedAt: null } }
      );
    }
    log("stamp", `${name}: ${DRY_RUN ? "would stamp" : "stamped"} ${missing} document(s)`);
  }
}

async function seedEmploymentHistory(orgId: mongoose.Types.ObjectId) {
  const db = mongoose.connection.db!;
  const employees = await db
    .collection(Employee.collection.name)
    .find({})
    .toArray();

  let created = 0;

  for (const emp of employees) {
    const already = await EmploymentHistory.findOne({
      orgId,
      employeeId: emp._id,
      changeType: "joined",
    }).lean();
    if (already) continue;

    if (!DRY_RUN) {
      await EmploymentHistory.create({
        orgId,
        employeeId: emp._id,
        changeType: "joined",
        field: "employment.dateOfJoining",
        newValue: emp.employment?.dateOfJoining ?? emp.joiningDate ?? null,
        effectiveFrom: emp.employment?.dateOfJoining ?? emp.joiningDate ?? new Date(),
        reason: "Backfilled during multi-tenant migration",
        changedByName: "Migration",
      });
    }
    created++;
  }

  log("history", `${DRY_RUN ? "would create" : "created"} ${created} joined record(s)`);
}

async function main() {
  console.log(
    `\n  Multi-tenant migration${DRY_RUN ? "  [DRY RUN — no writes]" : ""}\n`
  );

  await connect();

  await runAsSystem(async () => {
    const org = await ensureOrganization();
    const orgId = org._id as mongoose.Types.ObjectId;

    await migrateMemberships(orgId);
    const { deptMap, desigMap } = await createMasters(orgId);
    await migrateEmployees(orgId, deptMap, desigMap);
    await backfillReportsTo(orgId);
    await stampOrgId(orgId);
    await seedEmploymentHistory(orgId);
  });

  await mongoose.disconnect();

  console.log(
    DRY_RUN
      ? "\n  Dry run complete. Re-run without --dry-run to apply.\n"
      : "\n  Migration complete.\n"
  );
}

main().catch(async (err) => {
  console.error("\n  ✕ Migration failed:", err?.message ?? err, "\n");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
