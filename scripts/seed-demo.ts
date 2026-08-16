// scripts/seed-demo.ts
//
// Wipes the database and seeds a working demo organization.
//
//   npm run seed:demo -- --reset     drop everything, then seed
//   npm run seed:demo                seed into whatever is already there
//
// ⚠ --reset drops the ENTIRE database named in MONGODB_URI. Development only.
//
// Every account uses its own email address as its password. That is fine for
// local development and unacceptable anywhere else — see the warning printed
// at the end.

import "dotenv/config";
import mongoose from "mongoose";
import { connect } from "../lib/mongoose";
import { runAsSystem, runWithContext } from "../lib/context";
import { hashPassword } from "../lib/auth";

import Organization from "../model/Organization";
import User from "../model/User";
import Membership from "../model/Membership";
import Employee from "../model/Employee";
import Department from "../model/Department";
import Designation from "../model/Designation";
import Location from "../model/Location";
import Grade from "../model/Grade";
import EmploymentHistory from "../model/EmploymentHistory";
import { generateEmployeeCode } from "../lib/services/employee";

const RESET = process.argv.includes("--reset");

type Role = "ADMIN" | "MANAGER" | "EMPLOYEE";

interface SeedPerson {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  designation: string;
  department: string;
  reportsToEmail?: string;
}

const PEOPLE: SeedPerson[] = [
  {
    email: "admin@gmail.com",
    firstName: "Aditi",
    lastName: "Rao",
    role: "ADMIN",
    designation: "HR Manager",
    department: "Human Resources",
  },
  {
    email: "manager@gmail.com",
    firstName: "Rahul",
    lastName: "Nair",
    role: "MANAGER",
    designation: "Team Lead",
    department: "Engineering",
    reportsToEmail: "admin@gmail.com",
  },
  {
    email: "employee@gmail.com",
    firstName: "Priya",
    lastName: "Sharma",
    role: "EMPLOYEE",
    designation: "Developer",
    department: "Engineering",
    reportsToEmail: "manager@gmail.com",
  },
  {
    email: "employee2@gmail.com",
    firstName: "Karan",
    lastName: "Mehta",
    role: "EMPLOYEE",
    designation: "Associate",
    department: "Engineering",
    reportsToEmail: "manager@gmail.com",
  },
];

const DEPARTMENTS = [
  { name: "Engineering", code: "ENG" },
  { name: "Human Resources", code: "HR" },
  { name: "Sales", code: "SALES" },
  { name: "Finance", code: "FIN" },
];

const DESIGNATIONS = [
  { title: "Associate", code: "ASSOC" },
  { title: "Executive", code: "EXEC" },
  { title: "Developer", code: "DEV" },
  { title: "Senior Developer", code: "SRDEV" },
  { title: "Team Lead", code: "LEAD" },
  { title: "HR Manager", code: "HRM" },
];

const GRADES = [
  { name: "L1", code: "L1", level: 1 },
  { name: "L2", code: "L2", level: 2 },
  { name: "L3", code: "L3", level: 3 },
  { name: "L4", code: "L4", level: 4 },
];

const LOCATIONS = [
  {
    name: "Bengaluru HQ",
    code: "BLR",
    type: "head-office" as const,
    address: { city: "Bengaluru", state: "Karnataka", country: "India" },
  },
  {
    name: "Delhi Branch",
    code: "DEL",
    type: "branch" as const,
    address: { city: "New Delhi", state: "Delhi", country: "India" },
  },
];

function log(step: string, message: string) {
  console.log(`  ${step.padEnd(11)} ${message}`);
}

async function main() {
  const dbName = new URL(
    process.env.MONGODB_URI!.replace("mongodb+srv://", "https://")
  ).pathname.replace("/", "");

  console.log(`\n  Seeding demo data into "${dbName}"\n`);

  await connect();

  if (RESET) {
    await mongoose.connection.db!.dropDatabase();
    log("reset", `dropped database "${dbName}"`);
    // Indexes live with the collections that were just dropped; rebuild them
    // so the partial-unique constraints exist before any inserts.
    await Promise.all(
      [Organization, User, Membership, Employee, Department, Designation, Location, Grade]
        .map((m) => m.syncIndexes())
    );
    log("reset", "rebuilt indexes");
  }

  // --- Super admin + organization (no actor exists yet) --------------------
  const { superAdminId, orgId } = await runAsSystem(async () => {
    const superEmail = "superadmin@gmail.com";

    let superAdmin = await User.findOne({ email: superEmail });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: "Super Admin",
        email: superEmail,
        passwordHash: await hashPassword(superEmail),
        isSuperAdmin: true,
        status: "active",
      });
    }
    log("superadmin", superEmail);

    const name = process.env.ORG_NAME?.trim() || "Demo Company";
    const slug = (process.env.ORG_SLUG?.trim() || "demo").toLowerCase();

    let org = await Organization.findOne({ slug });
    if (!org) {
      org = await Organization.create({
        name,
        slug,
        legalName: `${name} Private Limited`,
        status: "active",
        employeeCodePrefix: "EMP",
        contact: { email: "hr@demo.test", phone: "+91 80 1234 5678" },
        address: { city: "Bengaluru", state: "Karnataka", country: "India" },
      });
    }
    log("org", `${name} (/${slug})`);

    return { superAdminId: String(superAdmin._id), orgId: String(org._id) };
  });

  // --- Everything else, acted by the super admin so it is audited ----------
  await runWithContext(
    {
      userId: superAdminId,
      userName: "Super Admin",
      userEmail: "superadmin@gmail.com",
      isSuperAdmin: true,
      orgId,
      role: null,
      employeeId: null,
    },
    async () => {
      // Masters
      const deptMap = new Map<string, any>();
      for (const d of DEPARTMENTS) {
        const doc =
          (await Department.findOne({ code: d.code })) ??
          (await Department.create({ ...d, orgId }));
        deptMap.set(d.name, doc._id);
      }

      const desigMap = new Map<string, any>();
      for (const d of DESIGNATIONS) {
        const doc =
          (await Designation.findOne({ code: d.code })) ??
          (await Designation.create({ ...d, orgId }));
        desigMap.set(d.title, doc._id);
      }

      for (const g of GRADES) {
        if (!(await Grade.findOne({ code: g.code }))) {
          await Grade.create({ ...g, orgId });
        }
      }

      let hqId: any = null;
      for (const l of LOCATIONS) {
        const doc =
          (await Location.findOne({ code: l.code })) ??
          (await Location.create({ ...l, orgId }));
        if (l.code === "BLR") hqId = doc._id;
      }

      log(
        "masters",
        `${DEPARTMENTS.length} departments, ${DESIGNATIONS.length} designations, ` +
          `${GRADES.length} grades, ${LOCATIONS.length} locations`
      );

      // People — created in list order so a manager exists before their reports.
      const employeeByEmail = new Map<string, any>();

      for (const person of PEOPLE) {
        const existingUser = await User.findOne({ email: person.email });
        if (existingUser) {
          const emp = await Employee.findOne({ userId: existingUser._id });
          if (emp) employeeByEmail.set(person.email, emp);
          log("skip", `${person.email} already exists`);
          continue;
        }

        const user = await User.create({
          name: `${person.firstName} ${person.lastName}`,
          email: person.email,
          // Password === email. Development only.
          passwordHash: await hashPassword(person.email),
          status: "active",
        });

        const reportsTo = person.reportsToEmail
          ? employeeByEmail.get(person.reportsToEmail)?._id ?? null
          : null;

        const dateOfJoining = new Date();
        dateOfJoining.setMonth(dateOfJoining.getMonth() - 8);

        const employee = await Employee.create({
          orgId,
          employeeCode: await generateEmployeeCode(orgId),
          firstName: person.firstName,
          lastName: person.lastName,
          userId: user._id,
          contact: {
            workEmail: person.email,
            personalPhone: "+91 90000 00000",
          },
          employment: {
            dateOfJoining,
            probationMonths: 6,
            employmentType: "full-time",
            workMode: "hybrid",
            status: "active",
          },
          departmentId: deptMap.get(person.department) ?? null,
          designationId: desigMap.get(person.designation) ?? null,
          locationId: hqId,
          reportsTo,
        });

        await Membership.create({
          userId: user._id,
          orgId,
          role: person.role,
          employeeId: employee._id,
          status: "active",
          joinedAt: new Date(),
        });

        await EmploymentHistory.create({
          orgId,
          employeeId: employee._id,
          changeType: "joined",
          field: "employment.dateOfJoining",
          newValue: dateOfJoining,
          effectiveFrom: dateOfJoining,
          changedByName: "Seed",
        });

        employeeByEmail.set(person.email, employee);
        log(
          person.role.toLowerCase(),
          `${person.email}  (${employee.employeeCode}, ${person.designation})`
        );
      }
    }
  );

  await mongoose.disconnect();

  console.log(`
  Accounts — password is the same as the email for every one:

    superadmin@gmail.com    Super Admin   all organizations
    admin@gmail.com         Admin         whole org, incl. PII
    manager@gmail.com       Manager       own team subtree, no PII
    employee@gmail.com      Employee      self only
    employee2@gmail.com     Employee      self only

  Reporting chain:  admin  →  manager  →  employee, employee2
  So manager@gmail.com resolves to a 3-person team scope.

  ⚠ These credentials are for local development only. Do not deploy this
    dataset, and never let email-as-password reach a real environment.
`);
}

main().catch(async (err) => {
  console.error("\n  ✕ Seed failed:", err?.message ?? err, "\n");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
