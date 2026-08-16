// scripts/seed-demo.ts
//
// Wipes the database and seeds a demo organisation with enough real data that
// the screens can be judged honestly. A dashboard full of zeros tells you
// nothing about whether the dashboard is any good.
//
//   npx tsx scripts/seed-demo.ts --reset     drop everything, then seed
//   npx tsx scripts/seed-demo.ts             seed into what is already there
//
// (Run it with npx, not `npm run -- --reset`: npm swallows --reset as its own
// config flag and it never reaches the script.)
//
// ⚠ --reset drops the ENTIRE database named in MONGODB_URI. Development only.
//
// Every account uses its own email address as its password.

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

const RESET = process.argv.includes("--reset");

/** Deterministic PRNG so re-seeding produces the same dataset. */
let seed = 20260816;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));

type Role = "ADMIN" | "MANAGER" | "LEAD" | "EMPLOYEE";

interface SeedPerson {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  designation: string;
  department: string;
  grade: string;
  reportsToEmail?: string;
  status?: "active" | "probation" | "notice-period" | "exited";
  monthsAgo: number;
}

const PEOPLE: SeedPerson[] = [
  // Leadership
  { email: "admin@gmail.com", firstName: "Aditi", lastName: "Rao", role: "ADMIN", designation: "HR Manager", department: "Human Resources", grade: "L4", monthsAgo: 34 },

  // Engineering — a manager with a lead under them, so the subtree nests
  { email: "manager@gmail.com", firstName: "Rahul", lastName: "Nair", role: "MANAGER", designation: "Engineering Manager", department: "Engineering", grade: "L4", reportsToEmail: "admin@gmail.com", monthsAgo: 28 },
  { email: "lead@gmail.com", firstName: "Sneha", lastName: "Goyal", role: "LEAD", designation: "Team Lead", department: "Engineering", grade: "L3", reportsToEmail: "manager@gmail.com", monthsAgo: 21 },
  { email: "employee@gmail.com", firstName: "Priya", lastName: "Sharma", role: "EMPLOYEE", designation: "Senior Developer", department: "Engineering", grade: "L3", reportsToEmail: "lead@gmail.com", monthsAgo: 20 },
  { email: "employee2@gmail.com", firstName: "Karan", lastName: "Mehta", role: "EMPLOYEE", designation: "Developer", department: "Engineering", grade: "L2", reportsToEmail: "lead@gmail.com", monthsAgo: 14 },
  { email: "ishaan.gupta@demo.test", firstName: "Ishaan", lastName: "Gupta", role: "EMPLOYEE", designation: "Developer", department: "Engineering", grade: "L2", reportsToEmail: "lead@gmail.com", monthsAgo: 11 },
  { email: "arjun.pillai@demo.test", firstName: "Arjun", lastName: "Pillai", role: "EMPLOYEE", designation: "Associate", department: "Engineering", grade: "L1", reportsToEmail: "lead@gmail.com", monthsAgo: 4, status: "probation" },
  { email: "meera.iyer@demo.test", firstName: "Meera", lastName: "Iyer", role: "EMPLOYEE", designation: "Associate", department: "Engineering", grade: "L1", reportsToEmail: "lead@gmail.com", monthsAgo: 2, status: "probation" },

  // Sales
  { email: "vikram.singh@demo.test", firstName: "Vikram", lastName: "Singh", role: "LEAD", designation: "Team Lead", department: "Sales", grade: "L4", reportsToEmail: "admin@gmail.com", monthsAgo: 26 },
  { email: "nisha.patel@demo.test", firstName: "Nisha", lastName: "Patel", role: "EMPLOYEE", designation: "Executive", department: "Sales", grade: "L2", reportsToEmail: "vikram.singh@demo.test", monthsAgo: 17 },
  { email: "rohit.verma@demo.test", firstName: "Rohit", lastName: "Verma", role: "EMPLOYEE", designation: "Executive", department: "Sales", grade: "L2", reportsToEmail: "vikram.singh@demo.test", monthsAgo: 13 },
  { email: "ananya.bose@demo.test", firstName: "Ananya", lastName: "Bose", role: "EMPLOYEE", designation: "Associate", department: "Sales", grade: "L1", reportsToEmail: "vikram.singh@demo.test", monthsAgo: 6 },
  { email: "farhan.khan@demo.test", firstName: "Farhan", lastName: "Khan", role: "EMPLOYEE", designation: "Associate", department: "Sales", grade: "L1", reportsToEmail: "vikram.singh@demo.test", monthsAgo: 3, status: "probation" },

  // Finance
  { email: "deepa.menon@demo.test", firstName: "Deepa", lastName: "Menon", role: "LEAD", designation: "Team Lead", department: "Finance", grade: "L4", reportsToEmail: "admin@gmail.com", monthsAgo: 30 },
  { email: "sanjay.kulkarni@demo.test", firstName: "Sanjay", lastName: "Kulkarni", role: "EMPLOYEE", designation: "Executive", department: "Finance", grade: "L3", reportsToEmail: "deepa.menon@demo.test", monthsAgo: 22 },
  { email: "tara.joshi@demo.test", firstName: "Tara", lastName: "Joshi", role: "EMPLOYEE", designation: "Executive", department: "Finance", grade: "L2", reportsToEmail: "deepa.menon@demo.test", monthsAgo: 10 },

  // HR
  { email: "kavya.reddy@demo.test", firstName: "Kavya", lastName: "Reddy", role: "EMPLOYEE", designation: "Executive", department: "Human Resources", grade: "L2", reportsToEmail: "admin@gmail.com", monthsAgo: 15 },
  { email: "manish.agarwal@demo.test", firstName: "Manish", lastName: "Agarwal", role: "EMPLOYEE", designation: "Associate", department: "Human Resources", grade: "L1", reportsToEmail: "admin@gmail.com", monthsAgo: 5 },

  // Serving notice, and one who has left — so "departed" and "away" are not zero
  { email: "gaurav.saxena@demo.test", firstName: "Gaurav", lastName: "Saxena", role: "EMPLOYEE", designation: "Developer", department: "Engineering", grade: "L2", reportsToEmail: "lead@gmail.com", monthsAgo: 19, status: "notice-period" },
  { email: "pooja.desai@demo.test", firstName: "Pooja", lastName: "Desai", role: "EMPLOYEE", designation: "Executive", department: "Sales", grade: "L2", reportsToEmail: "vikram.singh@demo.test", monthsAgo: 24, status: "exited" },
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
  { name: "Bengaluru HQ", code: "BLR", type: "head-office" as const, address: { city: "Bengaluru", state: "Karnataka", country: "India" } },
  { name: "Delhi Branch", code: "DEL", type: "branch" as const, address: { city: "New Delhi", state: "Delhi", country: "India" } },
];

const LEAVE_TYPES = [
  { code: "CL", name: "Casual Leave", quota: 12, paid: true },
  { code: "SL", name: "Sick Leave", quota: 6, paid: true },
  { code: "EL", name: "Earned Leave", quota: 15, paid: true },
  { code: "LOP", name: "Unpaid Leave (LOP)", quota: 0, paid: false },
];

const LEAVE_REASONS = [
  "Family function",
  "Not keeping well",
  "Personal work",
  "Travelling out of town",
  "Medical appointment",
  "Moving house",
  "Child's school event",
];

const ANNOUNCEMENTS = [
  {
    title: "Independence Day holiday",
    content:
      "The office will remain closed on Friday, 15 August. Attendance is not required and the day is not counted against your leave balance.",
    isPinned: true,
    daysAgo: 6,
  },
  {
    title: "Investment declarations open for FY 2026-27",
    content:
      "Submit your declarations before 30 September. Anything not declared by then is treated as nil for TDS purposes, and the correction can only be made at proof submission in January.",
    isPinned: true,
    daysAgo: 12,
  },
  {
    title: "New hires this month",
    content:
      "Meera Iyer joins Engineering as an Associate, and Farhan Khan joins Sales. Both are on a six-month probation. Please help them settle in.",
    isPinned: false,
    daysAgo: 20,
  },
  {
    title: "Quarterly all-hands, Thursday 4pm",
    content:
      "We will cover Q2 numbers, the hiring plan for the rest of the year, and an update on the new office floor. Bengaluru in the main room, Delhi on the call link.",
    isPinned: false,
    daysAgo: 31,
  },
];

const POLICIES = [
  {
    title: "Attendance and working hours",
    content:
      "Standard hours are 10:00 to 19:00 with an hour for lunch. Arrivals after 10:15 are recorded as late; three late marks in a month count as one half day. If you forget to punch, raise a regularisation within seven days and your lead can approve it.",
    category: "Attendance",
  },
  {
    title: "Leave policy",
    content:
      "Casual leave is 12 days a year, sick leave 6, earned leave 15. Casual and sick leave lapse at year end; earned leave carries forward up to 30 days. Apply at least two working days in advance except for sick leave. Weekends and holidays inside a leave period are not deducted.",
    category: "Leave",
  },
  {
    title: "Work from home",
    content:
      "Up to eight days a month with your lead's approval, recorded as WFH rather than leave. Client-facing roles should keep at least two days in office each week.",
    category: "Workplace",
  },
];

function log(step: string, message: string) {
  console.log(`  ${step.padEnd(12)} ${message}`);
}

function ymd(date: Date): string {
  return date.toISOString().split("T")[0];
}

function isWeekend(date: Date): boolean {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
}

async function main() {
  const dbName = new URL(
    process.env.MONGODB_URI!.replace("mongodb+srv://", "https://")
  ).pathname.replace("/", "");

  console.log(`\n  Seeding demo data into "${dbName}"\n`);

  await connect();
  const db = mongoose.connection.db!;

  if (RESET) {
    await db.dropDatabase();
    log("reset", `dropped database "${dbName}"`);
    await Promise.all(
      [Organization, User, Membership, Employee, Department, Designation, Location, Grade].map(
        (m) => m.syncIndexes()
      )
    );
    log("reset", "rebuilt indexes");
  }

  // --- Super admin + organisation (no actor exists yet) --------------------
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
        contact: { email: "hr@demo.test", phone: "+91 80 4123 5678" },
        address: { city: "Bengaluru", state: "Karnataka", country: "India" },
      });
    }
    log("org", `${name} (/${slug})`);

    return { superAdminId: String(superAdmin._id), orgId: String(org._id) };
  });

  await runWithContext(
    {
      userId: superAdminId,
      userName: "Super Admin",
      userEmail: "superadmin@gmail.com",
      isSuperAdmin: true,
      orgId,
      role: null,
      employeeId: null,
      suppressActivityLog: true,
    },
    async () => {
      // --- Masters -------------------------------------------------------
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

      const gradeMap = new Map<string, any>();
      for (const g of GRADES) {
        const doc =
          (await Grade.findOne({ code: g.code })) ?? (await Grade.create({ ...g, orgId }));
        gradeMap.set(g.name, doc._id);
      }

      let hqId: any = null;
      const locationIds: any[] = [];
      for (const l of LOCATIONS) {
        const doc =
          (await Location.findOne({ code: l.code })) ?? (await Location.create({ ...l, orgId }));
        locationIds.push(doc._id);
        if (l.code === "BLR") hqId = doc._id;
      }

      log(
        "masters",
        `${DEPARTMENTS.length} departments · ${DESIGNATIONS.length} designations · ` +
          `${GRADES.length} grades · ${LOCATIONS.length} locations`
      );

      // --- People --------------------------------------------------------
      const employeeByEmail = new Map<string, any>();
      const userByEmail = new Map<string, any>();
      let seq = 0;

      for (const person of PEOPLE) {
        let user = await User.findOne({ email: person.email });
        if (!user) {
          user = await User.create({
            name: `${person.firstName} ${person.lastName}`,
            email: person.email,
            passwordHash: await hashPassword(person.email), // password === email
            status: "active",
          });
        }
        userByEmail.set(person.email, user);

        let employee = await Employee.findOne({ userId: user._id });
        if (!employee) {
          seq += 1;
          const dateOfJoining = new Date();
          dateOfJoining.setMonth(dateOfJoining.getMonth() - person.monthsAgo);

          const status = person.status ?? "active";
          const exit =
            status === "exited"
              ? {
                  resignationDate: new Date(Date.now() - 75 * 864e5),
                  lastWorkingDay: new Date(Date.now() - 45 * 864e5),
                  noticePeriodDays: 30,
                  exitType: "resignation" as const,
                  exitReason: "Relocating to another city",
                  rehireEligible: true,
                  exitInterviewCompleted: true,
                }
              : status === "notice-period"
                ? {
                    resignationDate: new Date(Date.now() - 20 * 864e5),
                    lastWorkingDay: new Date(Date.now() + 10 * 864e5),
                    noticePeriodDays: 30,
                    exitType: "resignation" as const,
                    exitReason: "Higher studies",
                    rehireEligible: true,
                  }
                : undefined;

          employee = await Employee.create({
            orgId,
            employeeCode: `EMP${String(seq).padStart(4, "0")}`,
            firstName: person.firstName,
            lastName: person.lastName,
            userId: user._id,
            gender: pick(["male", "female"]),
            contact: {
              workEmail: person.email,
              personalPhone: `+91 9${between(100000000, 999999999)}`,
              currentAddress: { city: pick(["Bengaluru", "New Delhi"]), country: "India" },
            },
            employment: {
              dateOfJoining,
              probationMonths: 6,
              employmentType: "full-time",
              workMode: pick(["onsite", "hybrid", "hybrid"]),
              status,
            },
            departmentId: deptMap.get(person.department) ?? null,
            designationId: desigMap.get(person.designation) ?? null,
            gradeId: gradeMap.get(person.grade) ?? null,
            locationId: person.department === "Sales" ? pick(locationIds) : hqId,
            exit,
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
        }
        employeeByEmail.set(person.email, employee);

        const existingMembership = await Membership.findOne({ userId: user._id, orgId });
        if (!existingMembership) {
          await Membership.create({
            userId: user._id,
            orgId,
            role: person.role,
            employeeId: employee._id,
            status: person.status === "exited" ? "suspended" : "active",
            joinedAt: new Date(),
          });
        }
      }

      // Reporting lines, second pass so every manager exists first.
      for (const person of PEOPLE) {
        if (!person.reportsToEmail) continue;
        const self = employeeByEmail.get(person.email);
        const manager = employeeByEmail.get(person.reportsToEmail);
        if (self && manager && !self.reportsTo) {
          self.reportsTo = manager._id;
          await self.save();
        }
      }

      log("people", `${PEOPLE.length} employees with a full reporting tree`);

      // --- Attendance, leave, announcements, policies ---------------------
      // Written through the raw driver so orgId lands on these legacy
      // collections, which do not carry the tenant plugin yet.
      const activeUsers = PEOPLE.filter((p) => (p.status ?? "active") !== "exited");

      const attendanceRows: any[] = [];
      const today = new Date();
      const start = new Date(today);
      start.setMonth(start.getMonth() - 3);

      for (const person of activeUsers) {
        const user = userByEmail.get(person.email);
        const joined = new Date();
        joined.setMonth(joined.getMonth() - person.monthsAgo);

        for (let d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
          const day = new Date(d);
          if (isWeekend(day) || day < joined) continue;

          const roll = rand();
          // Today is left unmarked so the check-in card has something to do.
          if (ymd(day) === ymd(today)) continue;

          if (roll < 0.04) {
            attendanceRows.push({
              orgId: new mongoose.Types.ObjectId(orgId),
              userId: user._id,
              date: ymd(day),
              punches: [],
              totalHours: 0,
              status: "Absent",
              deletedAt: null,
              createdAt: day,
              updatedAt: day,
            });
            continue;
          }

          const inHour = 9;
          const inMinute = between(45, roll < 0.12 ? 75 : 59); // occasional late arrival
          const inTime = new Date(
            Date.UTC(day.getUTCFullYear(), day.getUTCMonth(), day.getUTCDate(), inHour, inMinute)
          );

          const halfDay = roll > 0.96;
          const outTime = new Date(inTime);
          outTime.setUTCHours(halfDay ? 14 : between(18, 19), between(0, 59));

          const hours = (outTime.getTime() - inTime.getTime()) / 3_600_000;

          attendanceRows.push({
            orgId: new mongoose.Types.ObjectId(orgId),
            userId: user._id,
            date: ymd(day),
            punches: [
              { type: "IN", time: inTime, device: "web" },
              { type: "OUT", time: outTime, device: "web" },
            ],
            totalHours: Number(hours.toFixed(2)),
            status: roll > 0.93 && !halfDay ? "WFH" : "Present",
            deletedAt: null,
            createdAt: day,
            updatedAt: day,
          });
        }
      }

      if (attendanceRows.length) {
        await db.collection("attendances").deleteMany({});
        await db.collection("attendances").insertMany(attendanceRows);
      }
      log("attendance", `${attendanceRows.length} day records across 3 months`);

      // Leave balances
      const year = today.getFullYear();
      const balanceRows: any[] = [];
      const leaveRows: any[] = [];

      for (const person of activeUsers) {
        const user = userByEmail.get(person.email);
        const approver = person.reportsToEmail
          ? userByEmail.get(person.reportsToEmail)
          : null;

        for (const type of LEAVE_TYPES) {
          const used = type.quota === 0 ? 0 : between(0, Math.min(5, type.quota));
          balanceRows.push({
            orgId: new mongoose.Types.ObjectId(orgId),
            userId: user._id,
            leaveType: type.code,
            year,
            totalCredited: type.quota,
            used,
            balance: type.quota - used,
            lastUpdated: new Date(),
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          });
        }

        // A couple of requests each, with a realistic status mix.
        const requestCount = between(1, 3);
        for (let i = 0; i < requestCount; i++) {
          const offset = between(-70, 25);
          const from = new Date(today);
          from.setDate(from.getDate() + offset);
          const to = new Date(from);
          to.setDate(to.getDate() + between(0, 2));

          const status = offset > 0 ? "Pending" : rand() < 0.85 ? "Approved" : "Rejected";
          const appliedAt = new Date(from);
          appliedAt.setDate(appliedAt.getDate() - between(3, 10));

          leaveRows.push({
            orgId: new mongoose.Types.ObjectId(orgId),
            userId: user._id,
            leaveType: pick(["CL", "SL", "EL"]),
            fromDate: from,
            toDate: to,
            isHalfDay: false,
            reason: pick(LEAVE_REASONS),
            status,
            approverId: approver?._id ?? null,
            approverRemarks:
              status === "Rejected" ? "Two people already out that week." : undefined,
            appliedAt,
            reviewedAt: status === "Pending" ? undefined : new Date(appliedAt.getTime() + 864e5),
            deletedAt: null,
            createdAt: appliedAt,
            updatedAt: appliedAt,
          });
        }
      }

      await db.collection("leavebalances").deleteMany({});
      await db.collection("leavebalances").insertMany(balanceRows);
      await db.collection("leaves").deleteMany({});
      await db.collection("leaves").insertMany(leaveRows);
      log(
        "leave",
        `${balanceRows.length} balances · ${leaveRows.length} requests ` +
          `(${leaveRows.filter((l) => l.status === "Pending").length} pending)`
      );

      // Announcements and policies
      const adminUser = userByEmail.get("admin@gmail.com");

      await db.collection("announcements").deleteMany({});
      await db.collection("announcements").insertMany(
        ANNOUNCEMENTS.map((a) => {
          const createdAt = new Date(Date.now() - a.daysAgo * 864e5);
          return {
            orgId: new mongoose.Types.ObjectId(orgId),
            title: a.title,
            content: a.content,
            isPinned: a.isPinned,
            sendEmail: false,
            createdBy: adminUser._id,
            targetRoles: [],
            deletedAt: null,
            createdAt,
            updatedAt: createdAt,
          };
        })
      );

      await db.collection("policies").deleteMany({});
      await db.collection("policies").insertMany(
        POLICIES.map((p) => ({
          orgId: new mongoose.Types.ObjectId(orgId),
          title: p.title,
          content: p.content,
          category: p.category,
          createdBy: adminUser._id,
          deletedAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        }))
      );

      log("content", `${ANNOUNCEMENTS.length} announcements · ${POLICIES.length} policies`);
    }
  );

  await mongoose.disconnect();

  console.log(`
  Sign in with any of these — the password is the same as the email:

    superadmin@gmail.com    Super admin   every organisation
    admin@gmail.com         Admin         whole org, including PII
    manager@gmail.com       Manager       own subtree, may modify it
    lead@gmail.com          Lead          own subtree, read-only on people
    employee@gmail.com      Employee      self only
    employee2@gmail.com     Employee      self only

  Fifteen more employees exist across Engineering, Sales, Finance and HR at
  <first>.<last>@demo.test, same password rule.

  Reporting tree:  Aditi (admin)
                     ├── Rahul (manager)
                     │     └── Sneha (lead) → 6 engineers
                     ├── Vikram (lead)      → 4 sales
                     └── Deepa (lead)       → 2 finance

  The nested manager → lead → employee chain is deliberate: it exercises
  $graphLookup subtree resolution more than one flat level would.

  One person is serving notice and one has left, so "away" and "departed"
  are not zero. Today is deliberately left unmarked so the check-in card
  has something to do.

  ⚠ Local development only. Never let email-as-password reach a real
    environment.
`);
}

main().catch(async (err) => {
  console.error("\n  ✕ Seed failed:", err?.message ?? err, "\n");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
