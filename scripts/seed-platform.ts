// scripts/seed-platform.ts
//
// Seeds four organisations, each with its own teams, people, attendance,
// leave, payroll and statutory configuration.
//
//   npx tsx --env-file=.env scripts/seed-platform.ts --reset
//   npx tsx --env-file=.env scripts/seed-platform.ts
//
// (Run it with npx, not `npm run -- --reset`: npm swallows --reset as its own
// config flag and it never reaches the script.)
//
// ⚠ --reset drops the ENTIRE database named in MONGODB_URI. Development only.
//
// Four tenants rather than one because most tenancy bugs are invisible with a
// single org: a missing orgId filter reads correctly right up until a second
// tenant exists. The four sit in different states (Karnataka, Maharashtra,
// Rajasthan, Tamil Nadu) so professional tax and LWF differ between them —
// which is also the only way to tell that statutory config is really per-org.
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
import StatutoryConfig from "../model/StatutoryConfig";
import SalaryStructure from "../model/SalaryStructure";
import PayrollRun from "../model/PayrollRun";
import Payslip from "../model/Payslip";
import {
  buildPayslip,
  financialYearFor,
  monthKey,
} from "../lib/services/payroll";

const RESET = process.argv.includes("--reset");

/** Deterministic PRNG so re-seeding produces the same dataset. */
let seed = 20260817;
function rand() {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
}
const pick = <T>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];
const between = (min: number, max: number) =>
  min + Math.floor(rand() * (max - min + 1));

type Role = "ADMIN" | "MANAGER" | "LEAD" | "EMPLOYEE";
type EmpStatus = "active" | "probation" | "notice-period" | "exited";

// ---------------------------------------------------------------------------
// Name pool
// ---------------------------------------------------------------------------

const FIRST_NAMES = [
  "Aarav",
  "Aditi",
  "Ananya",
  "Arjun",
  "Bhavna",
  "Chirag",
  "Deepa",
  "Devansh",
  "Farhan",
  "Gauri",
  "Harsh",
  "Ishaan",
  "Jaya",
  "Kabir",
  "Kavya",
  "Lakshmi",
  "Manish",
  "Meera",
  "Naveen",
  "Nisha",
  "Omkar",
  "Pooja",
  "Pranav",
  "Priya",
  "Rahul",
  "Riya",
  "Rohit",
  "Sanjay",
  "Shreya",
  "Sneha",
  "Tara",
  "Uday",
  "Varun",
  "Vidya",
  "Vikram",
  "Yash",
  "Zoya",
  "Anil",
  "Bina",
  "Girish",
  "Hema",
  "Imran",
  "Jatin",
  "Komal",
  "Lalit",
  "Mohit",
  "Neha",
  "Parth",
  "Rekha",
  "Sagar",
  "Tanvi",
  "Umesh",
  "Vandana",
  "Waseem",
  "Yamini",
  "Ajay",
  "Bharti",
  "Chetan",
  "Divya",
  "Ekta",
  "Faisal",
  "Geeta",
  "Hitesh",
  "Indu",
];

const LAST_NAMES = [
  "Sharma",
  "Verma",
  "Nair",
  "Iyer",
  "Reddy",
  "Menon",
  "Patel",
  "Shah",
  "Gupta",
  "Agarwal",
  "Joshi",
  "Kulkarni",
  "Desai",
  "Bose",
  "Khan",
  "Singh",
  "Pillai",
  "Goyal",
  "Mehta",
  "Saxena",
  "Rao",
  "Chauhan",
  "Bhatt",
  "Kapoor",
  "Malhotra",
  "Sinha",
  "Das",
  "Mishra",
  "Tiwari",
  "Yadav",
  "Naidu",
  "Ghosh",
];

let firstCursor = 0;
let lastCursor = 0;

/** Walks the pools rather than sampling, so no two people collide. */
function nextName(): { firstName: string; lastName: string } {
  const firstName = FIRST_NAMES[firstCursor % FIRST_NAMES.length];
  const lastName = LAST_NAMES[lastCursor % LAST_NAMES.length];
  firstCursor += 1;
  if (firstCursor % FIRST_NAMES.length === 0) lastCursor += 1;
  lastCursor += 1;
  return { firstName, lastName };
}

// ---------------------------------------------------------------------------
// Shared masters
// ---------------------------------------------------------------------------

const GRADES = [
  { name: "L1", code: "L1", level: 1 },
  { name: "L2", code: "L2", level: 2 },
  { name: "L3", code: "L3", level: 3 },
  { name: "L4", code: "L4", level: 4 },
];

const GROSS_BY_GRADE: Record<string, number> = {
  L1: 32_000_00,
  L2: 58_000_00,
  L3: 95_000_00,
  L4: 1_60_000_00,
};

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
  "Wedding in the family",
];

// ---------------------------------------------------------------------------
// Professional tax and LWF, by state
//
// ⚠ Illustrative and NOT CA-verified. Check against the current state
// notification before running real payroll.
// ---------------------------------------------------------------------------

interface StateRules {
  ptEnabled: boolean;
  ptSlabs: Array<{ from: number; to: number | null; amount: number }>;
  lwfEmployee: number;
  lwfEmployer: number;
  lwfMonths: number[];
}

const STATE_RULES: Record<string, StateRules> = {
  Karnataka: {
    ptEnabled: true,
    // Nil below ₹25,000 a month, ₹200 at or above.
    ptSlabs: [
      { from: 0, to: 24_999_00, amount: 0 },
      { from: 25_000_00, to: null, amount: 200_00 },
    ],
    lwfEmployee: 20_00,
    lwfEmployer: 40_00,
    lwfMonths: [12],
  },
  Maharashtra: {
    ptEnabled: true,
    ptSlabs: [
      { from: 0, to: 7_500_00, amount: 0 },
      { from: 7_500_01, to: 10_000_00, amount: 175_00 },
      { from: 10_000_01, to: null, amount: 200_00 },
    ],
    lwfEmployee: 25_00,
    lwfEmployer: 75_00,
    lwfMonths: [6, 12],
  },
  Rajasthan: {
    // Rajasthan levies no professional tax.
    ptEnabled: false,
    ptSlabs: [],
    lwfEmployee: 2_00,
    lwfEmployer: 4_00,
    lwfMonths: [12],
  },
  "Tamil Nadu": {
    ptEnabled: true,
    ptSlabs: [
      { from: 0, to: 21_000_00, amount: 0 },
      { from: 21_000_01, to: 30_000_00, amount: 135_00 },
      { from: 30_000_01, to: 45_000_00, amount: 315_00 },
      { from: 45_000_01, to: 60_000_00, amount: 690_00 },
      { from: 60_000_01, to: 75_000_00, amount: 1_025_00 },
      { from: 75_000_01, to: null, amount: 1_250_00 },
    ],
    lwfEmployee: 20_00,
    lwfEmployer: 40_00,
    lwfMonths: [12],
  },
};

// ---------------------------------------------------------------------------
// The four tenants
// ---------------------------------------------------------------------------

interface TeamSpec {
  /** Department name. */
  name: string;
  code: string;
  /** Title for whoever runs the team. */
  headTitle: string;
  /** Does the team head report as MANAGER (with a LEAD under them) or LEAD? */
  headRole: "MANAGER" | "LEAD";
  /** Individual contributors under the head (or under the lead, if there is one). */
  size: number;
  /** Titles the ICs draw from. */
  icTitles: string[];
}

interface OrgSpec {
  name: string;
  slug: string;
  legalName: string;
  codePrefix: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  /** Email domain for generated staff. */
  domain: string;
  /** Well-known logins, only for the flagship tenant. */
  wellKnownLogins?: boolean;
  locations: Array<{
    name: string;
    code: string;
    type: "head-office" | "branch";
    city: string;
    state: string;
  }>;
  teams: TeamSpec[];
  announcements: Array<{
    title: string;
    content: string;
    isPinned: boolean;
    daysAgo: number;
  }>;
  policies: Array<{ title: string; content: string; category: string }>;
}

const ORGS: OrgSpec[] = [
  {
    name: "Demo Company",
    slug: "demo",
    legalName: "Demo Company Private Limited",
    codePrefix: "EMP",
    city: "Bengaluru",
    state: "Karnataka",
    pincode: "560095",
    phone: "+91 80 4123 5678",
    domain: "demo.test",
    wellKnownLogins: true,
    locations: [
      {
        name: "Bengaluru HQ",
        code: "BLR",
        type: "head-office",
        city: "Bengaluru",
        state: "Karnataka",
      },
      {
        name: "Delhi Branch",
        code: "DEL",
        type: "branch",
        city: "New Delhi",
        state: "Delhi",
      },
    ],
    teams: [
      {
        name: "Engineering",
        code: "ENG",
        headTitle: "Engineering Manager",
        headRole: "MANAGER",
        size: 6,
        icTitles: ["Developer", "Senior Developer", "Associate"],
      },
      {
        name: "Sales",
        code: "SALES",
        headTitle: "Sales Lead",
        headRole: "LEAD",
        size: 4,
        icTitles: ["Executive", "Associate"],
      },
      {
        name: "Finance",
        code: "FIN",
        headTitle: "Finance Lead",
        headRole: "LEAD",
        size: 3,
        icTitles: ["Executive", "Associate"],
      },
    ],
    announcements: [
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
        title: "Quarterly all-hands, Thursday 4pm",
        content:
          "We will cover Q2 numbers, the hiring plan for the rest of the year, and an update on the new office floor. Bengaluru in the main room, Delhi on the call link.",
        isPinned: false,
        daysAgo: 31,
      },
    ],
    policies: [
      {
        title: "Attendance and working hours",
        content:
          "Standard hours are 10:00 to 19:00 with an hour for lunch. Arrivals after 10:15 are recorded as late; three late marks in a month count as one half day.",
        category: "Attendance",
      },
      {
        title: "Leave policy",
        content:
          "Casual leave is 12 days a year, sick leave 6, earned leave 15. Casual and sick leave lapse at year end; earned leave carries forward up to 30 days. Apply at least two working days in advance except for sick leave.",
        category: "Leave",
      },
      {
        title: "Work from home",
        content:
          "Up to eight days a month with your lead's approval, recorded as WFH rather than leave. Client-facing roles should keep at least two days in office each week.",
        category: "Workplace",
      },
    ],
  },
  {
    name: "Northwind Logistics",
    slug: "northwind",
    legalName: "Northwind Logistics India Private Limited",
    codePrefix: "NWL",
    city: "Pune",
    state: "Maharashtra",
    pincode: "411014",
    phone: "+91 20 6721 4400",
    domain: "northwind.test",
    locations: [
      {
        name: "Pune Hub",
        code: "PNQ",
        type: "head-office",
        city: "Pune",
        state: "Maharashtra",
      },
      {
        name: "Bhiwandi Warehouse",
        code: "BWD",
        type: "branch",
        city: "Bhiwandi",
        state: "Maharashtra",
      },
    ],
    teams: [
      {
        name: "Operations",
        code: "OPS",
        headTitle: "Operations Manager",
        headRole: "MANAGER",
        size: 7,
        icTitles: ["Dispatch Executive", "Operations Associate"],
      },
      {
        name: "Fleet",
        code: "FLEET",
        headTitle: "Fleet Lead",
        headRole: "LEAD",
        size: 5,
        icTitles: ["Fleet Coordinator", "Operations Associate"],
      },
      {
        name: "Accounts",
        code: "ACC",
        headTitle: "Accounts Lead",
        headRole: "LEAD",
        size: 3,
        icTitles: ["Accounts Executive", "Operations Associate"],
      },
    ],
    announcements: [
      {
        title: "Diwali dispatch schedule",
        content:
          "Warehouse operations run on a reduced roster from 18 to 22 October. Team leads have the shift plan; swap requests close on the 10th.",
        isPinned: true,
        daysAgo: 4,
      },
      {
        title: "New GPS units on the Nashik route",
        content:
          "All fourteen vehicles on the Nashik route now report live. Drivers should confirm the unit is powered before leaving the yard.",
        isPinned: false,
        daysAgo: 18,
      },
      {
        title: "Safety refresher — mandatory",
        content:
          "Everyone handling loading bay equipment must complete the refresher before month end. Ninety minutes, run twice daily at the Pune hub.",
        isPinned: false,
        daysAgo: 26,
      },
    ],
    policies: [
      {
        title: "Shift and overtime",
        content:
          "Operations runs two shifts, 06:00-14:00 and 14:00-22:00. Overtime beyond nine hours in a day is paid at 2x the ordinary rate and must be approved by the shift lead before it is worked.",
        category: "Attendance",
      },
      {
        title: "Vehicle and equipment handling",
        content:
          "Only staff with a current commercial licence on file may move vehicles inside the yard. Damage must be reported the same day, whatever the cause.",
        category: "Safety",
      },
      {
        title: "Leave policy",
        content:
          "Casual leave is 12 days a year, sick leave 6, earned leave 15. During peak season (October and November) leave is granted only against a confirmed shift swap.",
        category: "Leave",
      },
    ],
  },
  {
    name: "Saffron Retail",
    slug: "saffron",
    legalName: "Saffron Retail Ventures Private Limited",
    codePrefix: "SRV",
    city: "Jaipur",
    state: "Rajasthan",
    pincode: "302018",
    phone: "+91 141 405 9900",
    domain: "saffron.test",
    locations: [
      {
        name: "Jaipur Store",
        code: "JAI",
        type: "head-office",
        city: "Jaipur",
        state: "Rajasthan",
      },
      {
        name: "Udaipur Store",
        code: "UDR",
        type: "branch",
        city: "Udaipur",
        state: "Rajasthan",
      },
    ],
    teams: [
      {
        name: "Stores",
        code: "STORE",
        headTitle: "Store Manager",
        headRole: "MANAGER",
        size: 6,
        icTitles: ["Sales Associate", "Cashier"],
      },
      {
        name: "Merchandising",
        code: "MERCH",
        headTitle: "Merchandising Lead",
        headRole: "LEAD",
        size: 4,
        icTitles: ["Merchandiser", "Sales Associate"],
      },
    ],
    announcements: [
      {
        title: "Festive season floor plan",
        content:
          "The new floor plan goes live on the 1st. Merchandising has the layout; store staff should walk it with their manager before opening.",
        isPinned: true,
        daysAgo: 3,
      },
      {
        title: "Sunday roster",
        content:
          "Sundays are now covered on rotation rather than by seniority. The roster is published a fortnight ahead so swaps are possible.",
        isPinned: false,
        daysAgo: 15,
      },
    ],
    policies: [
      {
        title: "Store opening and closing",
        content:
          "Two staff members must be present at both opening and closing. Cash reconciliation happens before the shutter comes down, not the next morning.",
        category: "Operations",
      },
      {
        title: "Staff discount",
        content:
          "Thirty percent on own purchases, capped at ₹5,000 a month, billed through your own employee code. It cannot be used for anyone else.",
        category: "Benefits",
      },
      {
        title: "Leave policy",
        content:
          "Casual leave is 12 days a year, sick leave 6, earned leave 15. Leave is not normally approved on weekends during a sale period.",
        category: "Leave",
      },
    ],
  },
  {
    name: "Kaveri Health",
    slug: "kaveri",
    legalName: "Kaveri Health Services Private Limited",
    codePrefix: "KHS",
    city: "Chennai",
    state: "Tamil Nadu",
    pincode: "600096",
    phone: "+91 44 4210 7700",
    domain: "kaveri.test",
    locations: [
      {
        name: "Chennai Clinic",
        code: "MAA",
        type: "head-office",
        city: "Chennai",
        state: "Tamil Nadu",
      },
      {
        name: "Coimbatore Clinic",
        code: "CJB",
        type: "branch",
        city: "Coimbatore",
        state: "Tamil Nadu",
      },
    ],
    teams: [
      {
        name: "Clinical",
        code: "CLIN",
        headTitle: "Clinical Manager",
        headRole: "MANAGER",
        size: 6,
        icTitles: ["Staff Nurse", "Clinical Associate"],
      },
      {
        name: "Patient Support",
        code: "SUPP",
        headTitle: "Support Lead",
        headRole: "LEAD",
        size: 4,
        icTitles: ["Front Desk Executive", "Clinical Associate"],
      },
      {
        name: "Billing",
        code: "BILL",
        headTitle: "Billing Lead",
        headRole: "LEAD",
        size: 3,
        icTitles: ["Billing Executive", "Front Desk Executive"],
      },
    ],
    announcements: [
      {
        title: "Rosters move to a four-week cycle",
        content:
          "From next month rosters are published four weeks ahead instead of two. Requests for a specific week close ten days before the cycle starts.",
        isPinned: true,
        daysAgo: 5,
      },
      {
        title: "Coimbatore clinic extends evening hours",
        content:
          "The Coimbatore clinic will stay open until 21:00 on weekdays. Two additional support staff join this month to cover it.",
        isPinned: false,
        daysAgo: 21,
      },
      {
        title: "Annual health check for staff",
        content:
          "Booked through the front desk, any weekday in the last week of the month. It does not count against sick leave.",
        isPinned: false,
        daysAgo: 34,
      },
    ],
    policies: [
      {
        title: "Patient confidentiality",
        content:
          "Patient information is discussed only where it cannot be overheard, and never outside the clinic. Records are accessed on a need-to-know basis and every access is logged.",
        category: "Compliance",
      },
      {
        title: "Roster and shift swaps",
        content:
          "Swaps must be agreed between both staff members and confirmed by the shift lead at least 48 hours ahead. An unconfirmed swap leaves the original person responsible.",
        category: "Attendance",
      },
      {
        title: "Leave policy",
        content:
          "Casual leave is 12 days a year, sick leave 6, earned leave 15. Clinical staff leave requires cover to be arranged before approval.",
        category: "Leave",
      },
    ],
  },
];

// ---------------------------------------------------------------------------

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

interface SeedPerson {
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
  designation: string;
  department: string;
  grade: string;
  reportsToEmail?: string;
  status: EmpStatus;
  monthsAgo: number;
}

/**
 * Turns a team spec into people: a head, an optional lead beneath them when
 * the team is big enough to need one, and the ICs.
 *
 * Every org gets at least one manager → lead → employee chain, because a flat
 * hierarchy never exercises $graphLookup subtree resolution properly.
 */
function buildPeople(spec: OrgSpec): SeedPerson[] {
  const people: SeedPerson[] = [];
  const domain = spec.domain;

  const emailFor = (first: string, last: string) =>
    `${first}.${last}@${domain}`.toLowerCase();

  // The org admin sits in HR and everyone senior reports to them.
  const adminName = nextName();
  const adminEmail = spec.wellKnownLogins
    ? "admin@gmail.com"
    : `admin@${domain}`;

  people.push({
    email: adminEmail,
    firstName: adminName.firstName,
    lastName: adminName.lastName,
    role: "ADMIN",
    designation: "HR Manager",
    department: "Human Resources",
    grade: "L4",
    status: "active",
    monthsAgo: between(30, 40),
  });

  for (const [teamIndex, team] of spec.teams.entries()) {
    const flagshipTeam = spec.wellKnownLogins && teamIndex === 0;

    // Team head
    const headName = nextName();
    const headEmail =
      flagshipTeam && team.headRole === "MANAGER"
        ? "manager@gmail.com"
        : emailFor(headName.firstName, headName.lastName);

    people.push({
      email: headEmail,
      firstName: headName.firstName,
      lastName: headName.lastName,
      role: team.headRole,
      designation: team.headTitle,
      department: team.name,
      grade: "L4",
      reportsToEmail: adminEmail,
      status: "active",
      monthsAgo: between(20, 32),
    });

    // A lead under a manager, so the tree is three deep somewhere.
    let icParent = headEmail;
    if (team.headRole === "MANAGER") {
      const leadName = nextName();
      const leadEmail = flagshipTeam
        ? "lead@gmail.com"
        : emailFor(leadName.firstName, leadName.lastName);

      people.push({
        email: leadEmail,
        firstName: leadName.firstName,
        lastName: leadName.lastName,
        role: "LEAD",
        designation: "Team Lead",
        department: team.name,
        grade: "L3",
        reportsToEmail: headEmail,
        status: "active",
        monthsAgo: between(14, 24),
      });
      icParent = leadEmail;
    }

    for (let i = 0; i < team.size; i++) {
      const icName = nextName();
      let email = emailFor(icName.firstName, icName.lastName);
      if (flagshipTeam && i === 0) email = "employee@gmail.com";
      if (flagshipTeam && i === 1) email = "employee2@gmail.com";

      // A realistic status mix: mostly active, a couple on probation, one
      // serving notice per org and one who has already left.
      const monthsAgo = between(1, 22);
      let status: EmpStatus = "active";
      if (monthsAgo <= 4) status = "probation";
      if (teamIndex === 0 && i === team.size - 1) status = "notice-period";
      if (teamIndex === 1 && i === team.size - 1) status = "exited";

      const grade = monthsAgo > 18 ? "L3" : monthsAgo > 8 ? "L2" : "L1";

      people.push({
        email,
        firstName: icName.firstName,
        lastName: icName.lastName,
        role: "EMPLOYEE",
        designation: pick(team.icTitles),
        department: team.name,
        grade,
        reportsToEmail: icParent,
        status,
        monthsAgo,
      });
    }
  }

  return people;
}

// ---------------------------------------------------------------------------

async function main() {
  const dbName = new URL(
    process.env.MONGODB_URI!.replace("mongodb+srv://", "https://"),
  ).pathname.replace("/", "");

  console.log(`\n  Seeding four organisations into "${dbName}"\n`);

  await connect();
  const db = mongoose.connection.db!;

  if (RESET) {
    await db.dropDatabase();
    log("reset", `dropped database "${dbName}"`);
    await Promise.all(
      [
        Organization,
        User,
        Membership,
        Employee,
        Department,
        Designation,
        Location,
        Grade,
        StatutoryConfig,
        SalaryStructure,
        PayrollRun,
        Payslip,
      ].map((m) => m.syncIndexes()),
    );
    log("reset", "rebuilt indexes");
  }

  // These collections are written through the raw driver below, so they are
  // cleared once here rather than per-org — clearing inside the loop would
  // wipe the tenants seeded before it.
  for (const c of [
    "attendances",
    "leaves",
    "leavebalances",
    "announcements",
    "policies",
  ]) {
    await db.collection(c).deleteMany({});
  }

  const superAdminId = await runAsSystem(async () => {
    const email = "superadmin@gmail.com";
    let superAdmin = await User.findOne({ email });
    if (!superAdmin) {
      superAdmin = await User.create({
        name: "Super Admin",
        email,
        passwordHash: await hashPassword(email),
        isSuperAdmin: true,
        status: "active",
      });
    }
    log("superadmin", email);
    return String(superAdmin._id);
  });

  const today = new Date();
  const summary: Array<{
    org: string;
    slug: string;
    people: number;
    teams: number;
  }> = [];

  for (const spec of ORGS) {
    console.log(
      `\n  ── ${spec.name} (/${spec.slug}) ──────────────────────────`,
    );

    const orgId = await runAsSystem(async () => {
      let org = await Organization.findOne({ slug: spec.slug });
      if (!org) {
        org = await Organization.create({
          name: spec.name,
          slug: spec.slug,
          legalName: spec.legalName,
          status: "active",
          employeeCodePrefix: spec.codePrefix,
          contact: { email: `hr@${spec.domain}`, phone: spec.phone },
          address: {
            line1: `${between(1, 90)} ${pick(["MG Road", "Ring Road", "Industrial Estate", "Anna Salai", "JLN Marg"])}`,
            city: spec.city,
            state: spec.state,
            country: "India",
            pincode: spec.pincode,
          },
          statutory: {
            pan: `AAACS${between(1000, 9999)}${pick(["A", "B", "C", "K", "M"])}`,
            tan: `${spec.codePrefix.slice(0, 4)}${between(10000, 99999)}${pick(["A", "B", "F"])}`,
            gstin: `29AAACS${between(1000, 9999)}${pick(["A", "B", "C"])}1Z${between(1, 9)}`,
          },
        });
      }
      return String(org._id);
    });

    const people = buildPeople(spec);

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
        // --- Masters ------------------------------------------------------
        const departments = [
          ...spec.teams.map((t) => ({ name: t.name, code: t.code })),
          { name: "Human Resources", code: "HR" },
        ];

        const deptMap = new Map<string, any>();
        for (const d of departments) {
          const doc =
            (await Department.findOne({ code: d.code })) ??
            (await Department.create({ ...d, orgId }));
          deptMap.set(d.name, doc._id);
        }

        const titles = new Set<string>(["HR Manager", "Team Lead"]);
        for (const t of spec.teams) {
          titles.add(t.headTitle);
          for (const ic of t.icTitles) titles.add(ic);
        }

        const desigMap = new Map<string, any>();
        for (const title of titles) {
          const code = title
            .toUpperCase()
            .replace(/[^A-Z ]/g, "")
            .split(" ")
            .map((w) => w.slice(0, 3))
            .join("")
            .slice(0, 10);
          const doc =
            (await Designation.findOne({ title })) ??
            (await Designation.create({ title, code, orgId }));
          desigMap.set(title, doc._id);
        }

        const gradeMap = new Map<string, any>();
        for (const g of GRADES) {
          const doc =
            (await Grade.findOne({ code: g.code })) ??
            (await Grade.create({ ...g, orgId }));
          gradeMap.set(g.name, doc._id);
        }

        let hqId: any = null;
        const locationIds: any[] = [];
        for (const l of spec.locations) {
          const doc =
            (await Location.findOne({ code: l.code })) ??
            (await Location.create({
              name: l.name,
              code: l.code,
              type: l.type,
              address: { city: l.city, state: l.state, country: "India" },
              orgId,
            }));
          locationIds.push(doc._id);
          if (l.type === "head-office") hqId = doc._id;
        }

        log(
          "masters",
          `${departments.length} departments · ${titles.size} designations · ` +
            `${GRADES.length} grades · ${spec.locations.length} locations`,
        );

        // --- People -------------------------------------------------------
        const employeeByEmail = new Map<string, any>();
        const userByEmail = new Map<string, any>();
        let seq = 0;

        for (const person of people) {
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

            const exit =
              person.status === "exited"
                ? {
                    resignationDate: new Date(Date.now() - 75 * 864e5),
                    lastWorkingDay: new Date(Date.now() - 45 * 864e5),
                    noticePeriodDays: 30,
                    exitType: "resignation" as const,
                    exitReason: "Relocating to another city",
                    rehireEligible: true,
                    exitInterviewCompleted: true,
                  }
                : person.status === "notice-period"
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
              employeeCode: `${spec.codePrefix}${String(seq).padStart(4, "0")}`,
              firstName: person.firstName,
              lastName: person.lastName,
              userId: user._id,
              gender: pick(["male", "female"]),
              contact: {
                workEmail: person.email,
                personalPhone: `+91 9${between(100000000, 999999999)}`,
                currentAddress: {
                  city: spec.city,
                  state: spec.state,
                  country: "India",
                },
              },
              // Encrypted at rest by the schema's setters. Present so the bank
              // advice file and statutory reports have something real in them.
              statutory: {
                pan: `ABCPD${between(1000, 9999)}${pick(["A", "B", "C", "K", "M"])}`,
                uan: `10${between(10000000, 99999999)}${between(10, 99)}`,
              },
              bank: {
                accountHolderName: `${person.firstName} ${person.lastName}`,
                accountNumber: `${between(10000000, 99999999)}${between(1000, 9999)}`,
                ifsc: pick([
                  "HDFC0001234",
                  "ICIC0004567",
                  "SBIN0007890",
                  "UTIB0002345",
                ]),
                bankName: pick([
                  "HDFC Bank",
                  "ICICI Bank",
                  "State Bank of India",
                  "Axis Bank",
                ]),
                branch: pick([
                  "Koramangala",
                  "Kalyani Nagar",
                  "Vaishali Nagar",
                  "Adyar",
                ]),
              },
              employment: {
                dateOfJoining,
                probationMonths: 6,
                employmentType: "full-time",
                workMode: pick(["onsite", "onsite", "hybrid"]),
                status: person.status,
              },
              departmentId: deptMap.get(person.department) ?? null,
              designationId: desigMap.get(person.designation) ?? null,
              gradeId: gradeMap.get(person.grade) ?? null,
              locationId:
                locationIds.length > 1 && rand() < 0.3
                  ? pick(locationIds)
                  : hqId,
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

          const existing = await Membership.findOne({
            userId: user._id,
            orgId,
          });
          if (!existing) {
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
        for (const person of people) {
          if (!person.reportsToEmail) continue;
          const self = employeeByEmail.get(person.email);
          const manager = employeeByEmail.get(person.reportsToEmail);
          if (self && manager && !self.reportsTo) {
            self.reportsTo = manager._id;
            await self.save();
          }
        }

        // These codes were assigned directly, so the org's counter still reads
        // zero and the next employee added through the UI would be handed
        // EMP0001 again. generateEmployeeCode() now skips taken codes anyway,
        // but leaving the counter wrong just to lean on that would be sloppy.
        await Organization.findByIdAndUpdate(orgId, {
          $set: { employeeCodeSeq: seq },
        });

        log(
          "people",
          `${people.length} across ${spec.teams.length} teams ` +
            `(${people.filter((p) => p.status === "probation").length} on probation, ` +
            `${people.filter((p) => p.status === "exited").length} exited)`,
        );

        // --- Attendance ----------------------------------------------------
        const activePeople = people.filter((p) => p.status !== "exited");
        const attendanceRows: any[] = [];
        const start = new Date(today);
        start.setMonth(start.getMonth() - 3);

        for (const person of activePeople) {
          const user = userByEmail.get(person.email);
          const joined = new Date();
          joined.setMonth(joined.getMonth() - person.monthsAgo);

          for (
            let d = new Date(start);
            d <= today;
            d.setDate(d.getDate() + 1)
          ) {
            const day = new Date(d);
            if (isWeekend(day) || day < joined) continue;
            // Today is left unmarked so the check-in card has something to do.
            if (ymd(day) === ymd(today)) continue;

            const roll = rand();

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

            const inTime = new Date(
              Date.UTC(
                day.getUTCFullYear(),
                day.getUTCMonth(),
                day.getUTCDate(),
                9,
                between(45, roll < 0.12 ? 75 : 59), // occasional late arrival
              ),
            );

            const halfDay = roll > 0.96;
            const outTime = new Date(inTime);
            outTime.setUTCHours(halfDay ? 14 : between(18, 19), between(0, 59));

            attendanceRows.push({
              orgId: new mongoose.Types.ObjectId(orgId),
              userId: user._id,
              date: ymd(day),
              punches: [
                { type: "IN", time: inTime, device: "web" },
                { type: "OUT", time: outTime, device: "web" },
              ],
              totalHours: Number(
                ((outTime.getTime() - inTime.getTime()) / 3_600_000).toFixed(2),
              ),
              status: roll > 0.93 && !halfDay ? "WFH" : "Present",
              deletedAt: null,
              createdAt: day,
              updatedAt: day,
            });
          }
        }

        if (attendanceRows.length) {
          await db.collection("attendances").insertMany(attendanceRows);
        }
        log(
          "attendance",
          `${attendanceRows.length} day records across 3 months`,
        );

        // --- Leave ---------------------------------------------------------
        const year = today.getFullYear();
        const balanceRows: any[] = [];
        const leaveRows: any[] = [];

        for (const person of activePeople) {
          const user = userByEmail.get(person.email);
          const approver = person.reportsToEmail
            ? userByEmail.get(person.reportsToEmail)
            : null;

          for (const type of LEAVE_TYPES) {
            const used =
              type.quota === 0 ? 0 : between(0, Math.min(5, type.quota));
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

          for (let i = 0; i < between(1, 3); i++) {
            const offset = between(-70, 25);
            const from = new Date(today);
            from.setDate(from.getDate() + offset);
            const to = new Date(from);
            to.setDate(to.getDate() + between(0, 2));

            const status =
              offset > 0 ? "Pending" : rand() < 0.85 ? "Approved" : "Rejected";
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
                status === "Rejected"
                  ? "Two people already out that week."
                  : undefined,
              appliedAt,
              reviewedAt:
                status === "Pending"
                  ? undefined
                  : new Date(appliedAt.getTime() + 864e5),
              deletedAt: null,
              createdAt: appliedAt,
              updatedAt: appliedAt,
            });
          }
        }

        await db.collection("leavebalances").insertMany(balanceRows);
        await db.collection("leaves").insertMany(leaveRows);
        log(
          "leave",
          `${balanceRows.length} balances · ${leaveRows.length} requests ` +
            `(${leaveRows.filter((l) => l.status === "Pending").length} pending)`,
        );

        // --- Announcements and policies -------------------------------------
        const adminUser = userByEmail.get(people[0].email);

        await db.collection("announcements").insertMany(
          spec.announcements.map((a) => {
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
          }),
        );

        await db.collection("policies").insertMany(
          spec.policies.map((p) => ({
            orgId: new mongoose.Types.ObjectId(orgId),
            title: p.title,
            content: p.content,
            category: p.category,
            createdBy: adminUser._id,
            deletedAt: null,
            createdAt: new Date(),
            updatedAt: new Date(),
          })),
        );

        log(
          "content",
          `${spec.announcements.length} announcements · ${spec.policies.length} policies`,
        );

        // --- Statutory config ----------------------------------------------
        const fy = financialYearFor(today);
        const rules = STATE_RULES[spec.state];

        let config = await StatutoryConfig.findOne({ financialYear: fy });
        if (!config) {
          config = await StatutoryConfig.create({
            orgId,
            financialYear: fy,
            professionalTax: {
              enabled: rules.ptEnabled,
              state: spec.state,
              slabs: rules.ptSlabs,
              annualCap: 2_500_00,
            },
            lwf: {
              enabled: true,
              state: spec.state,
              employeeAmount: rules.lwfEmployee,
              employerAmount: rules.lwfEmployer,
              deductionMonths: rules.lwfMonths,
            },
            incomeTax: {
              defaultRegime: "new",
              standardDeductionNew: 75_000_00,
              standardDeductionOld: 50_000_00,
              newRegimeSlabs: [
                { from: 0, to: 4_00_000_00, rate: 0 },
                { from: 4_00_000_00, to: 8_00_000_00, rate: 5 },
                { from: 8_00_000_00, to: 12_00_000_00, rate: 10 },
                { from: 12_00_000_00, to: 16_00_000_00, rate: 15 },
                { from: 16_00_000_00, to: 20_00_000_00, rate: 20 },
                { from: 20_00_000_00, to: 24_00_000_00, rate: 25 },
                { from: 24_00_000_00, to: null, rate: 30 },
              ],
              oldRegimeSlabs: [
                { from: 0, to: 2_50_000_00, rate: 0 },
                { from: 2_50_000_00, to: 5_00_000_00, rate: 5 },
                { from: 5_00_000_00, to: 10_00_000_00, rate: 20 },
                { from: 10_00_000_00, to: null, rate: 30 },
              ],
              cessRate: 4,
            },
          });
        }
        log(
          "statutory",
          `FY ${fy} · PT ${rules.ptEnabled ? spec.state : "not levied in " + spec.state}`,
        );

        // --- Salary structures ----------------------------------------------
        const structureByEmail = new Map<string, any>();

        for (const person of activePeople) {
          const employee = employeeByEmail.get(person.email);
          if (!employee) continue;

          const gross = GROSS_BY_GRADE[person.grade] ?? 40_000_00;

          // A conventional Indian breakup: basic 40% of gross, HRA half of
          // basic, a fixed conveyance allowance, remainder as special.
          const basic = Math.round(gross * 0.4);
          const hra = Math.round(basic * 0.5);
          const conveyance = 1_600_00;
          const special = gross - basic - hra - conveyance;

          const effectiveFrom = new Date();
          effectiveFrom.setMonth(effectiveFrom.getMonth() - person.monthsAgo);

          let structure = await SalaryStructure.findOne({
            employeeId: employee._id,
          });
          if (!structure) {
            structure = await SalaryStructure.create({
              orgId,
              employeeId: employee._id,
              annualCtc: gross * 12,
              monthlyGross: gross,
              components: [
                {
                  code: "BASIC",
                  name: "Basic",
                  type: "earning",
                  monthly: basic,
                  partOfCtc: true,
                  taxable: true,
                  isStatutory: false,
                },
                {
                  code: "HRA",
                  name: "House Rent Allowance",
                  type: "earning",
                  monthly: hra,
                  partOfCtc: true,
                  taxable: true,
                  isStatutory: false,
                },
                {
                  code: "CONVEYANCE",
                  name: "Conveyance Allowance",
                  type: "earning",
                  monthly: conveyance,
                  partOfCtc: true,
                  taxable: true,
                  isStatutory: false,
                },
                {
                  code: "SPECIAL",
                  name: "Special Allowance",
                  type: "earning",
                  monthly: special,
                  partOfCtc: true,
                  taxable: true,
                  isStatutory: false,
                },
              ],
              effectiveFrom,
              effectiveTo: null,
            });
          }
          structureByEmail.set(person.email, structure);
        }

        log("salary", `${structureByEmail.size} salary structures`);

        // --- Payroll ---------------------------------------------------------
        const attendanceByUserMonth = new Map<
          string,
          { present: number; absent: number }
        >();
        for (const row of attendanceRows) {
          const key = `${row.userId}:${row.date.slice(0, 7)}`;
          const entry = attendanceByUserMonth.get(key) ?? {
            present: 0,
            absent: 0,
          };
          if (row.status === "Absent") entry.absent += 1;
          else entry.present += 1;
          attendanceByUserMonth.set(key, entry);
        }

        let runCount = 0;
        let payslipCount = 0;

        for (let back = 1; back <= 3; back++) {
          const monthDate = new Date(
            today.getFullYear(),
            today.getMonth() - back,
            1,
          );
          const month = monthKey(monthDate);

          if (await PayrollRun.findOne({ month })) continue;

          const run = await PayrollRun.create({
            orgId,
            month,
            financialYear: financialYearFor(monthDate),
            status: "paid",
            computedAt: new Date(
              monthDate.getFullYear(),
              monthDate.getMonth() + 1,
              1,
            ),
            approvedAt: new Date(
              monthDate.getFullYear(),
              monthDate.getMonth() + 1,
              2,
            ),
            paidAt: new Date(
              monthDate.getFullYear(),
              monthDate.getMonth() + 1,
              3,
            ),
          });

          const totals = {
            grossEarnings: 0,
            totalDeductions: 0,
            netPayable: 0,
            employerCost: 0,
            employeeCount: 0,
            payslipCount: 0,
          };

          for (const person of activePeople) {
            const employee = employeeByEmail.get(person.email);
            const structure = structureByEmail.get(person.email);
            const user = userByEmail.get(person.email);
            if (!employee || !structure) continue;

            const joined = new Date();
            joined.setMonth(joined.getMonth() - person.monthsAgo);
            if (joined > monthDate) continue; // not employed that month

            const stats = attendanceByUserMonth.get(`${user._id}:${month}`) ?? {
              present: 22,
              absent: 0,
            };
            const workingDays = stats.present + stats.absent || 22;

            const computed = buildPayslip({
              structure: structure.toObject ? structure.toObject() : structure,
              attendance: {
                workingDays,
                paidDays: stats.present,
                lopDays: stats.absent,
                leaveDays: 0,
              },
              config: config.toObject
                ? (config.toObject() as any)
                : (config as any),
              month,
            });

            await Payslip.create({
              orgId,
              payrollRunId: run._id,
              employeeId: employee._id,
              month,
              financialYear: run.financialYear,
              snapshot: {
                employeeCode: employee.employeeCode,
                displayName: employee.displayName,
                designation: person.designation,
                department: person.department,
                location: spec.locations[0].name,
                dateOfJoining: employee.employment.dateOfJoining,
                pan: null,
                uan: null,
                bankName: "HDFC Bank",
                bankAccountTail: String(between(1000, 9999)),
              },
              attendance: {
                workingDays,
                paidDays: stats.present,
                lopDays: stats.absent,
                leaveDays: 0,
              },
              ...computed,
            });

            totals.grossEarnings += computed.grossEarnings;
            totals.totalDeductions += computed.totalDeductions;
            totals.netPayable += computed.netPay;
            totals.employerCost += computed.employerCost;
            totals.employeeCount += 1;
            totals.payslipCount += 1;
            payslipCount += 1;
          }

          run.totals = totals;
          await run.save();
          runCount += 1;
        }

        log("payroll", `${runCount} monthly runs · ${payslipCount} payslips`);
      },
    );

    summary.push({
      org: spec.name,
      slug: spec.slug,
      people: people.length,
      teams: spec.teams.length,
    });
  }

  await mongoose.disconnect();

  const totalPeople = summary.reduce((n, s) => n + s.people, 0);

  console.log(`
  ─────────────────────────────────────────────────────────────

  ${summary.length} organisations · ${totalPeople} employees

${summary
  .map(
    (s) =>
      `    ${s.org.padEnd(22)} /${s.slug.padEnd(12)} ${String(s.people).padStart(2)} people · ${s.teams} teams`,
  )
  .join("\n")}

  Sign in with any of these — the password is the same as the email:

    superadmin@gmail.com      Super admin, every organisation
    admin@gmail.com           Admin of Demo Company
    manager@gmail.com         Manager, Demo Company Engineering
    lead@gmail.com            Lead, Demo Company Engineering
    employee@gmail.com        Employee, Demo Company Engineering
    employee2@gmail.com       Employee, Demo Company Engineering

  The other three tenants use admin@<slug>.test for the admin, and
  <first>.<last>@<slug>.test for everyone else — northwind.test,
  saffron.test, kaveri.test. Same password rule.

  Every org has a manager → lead → employee chain in its first team, so
  $graphLookup subtree resolution is exercised more than one flat level
  would. Each has someone on notice and someone who has left, so "away"
  and "departed" are never zero.

  The four sit in different states, so professional tax and LWF differ:
  Karnataka, Maharashtra, Rajasthan (no PT at all) and Tamil Nadu.

  ⚠ Statutory slabs here are illustrative and NOT CA-verified.
  ⚠ Local development only. Never let email-as-password reach production.
`);
}

main().catch(async (err) => {
  console.error("\n  ✕ Seed failed:", err?.message ?? err, "\n");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
