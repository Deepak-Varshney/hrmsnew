// scripts/list-logins.ts
//
// Prints every seeded login, grouped by organisation and role.
//
//   npx tsx --env-file=.env scripts/list-logins.ts
//
// The password is always the same as the email address. Development only.

import "dotenv/config";
import mongoose from "mongoose";
import { connect } from "../lib/mongoose";
import { runAsSystem } from "../lib/context";
import Organization from "../model/Organization";
import Membership from "../model/Membership";
import User from "../model/User";
import Employee from "../model/Employee";

const ROLE_ORDER = ["ADMIN", "MANAGER", "LEAD", "EMPLOYEE"];

async function main() {
  await connect();

  await runAsSystem(async () => {
    const superAdmins = await User.find({ isSuperAdmin: true })
      .select("name email status")
      .lean();

    console.log("\n═══ SUPER ADMIN ═══ (every organisation)\n");
    for (const u of superAdmins as any[]) {
      console.log(`  ${u.email.padEnd(32)} ${u.name}`);
    }

    const orgs = await Organization.find().sort({ createdAt: 1 }).lean();

    for (const org of orgs as any[]) {
      const memberships = await Membership.find({ orgId: org._id })
        .populate("userId", "name email status")
        .populate("employeeId", "employeeCode displayName")
        .lean();

      const employees = await Employee.find({ orgId: org._id })
        .select("displayName departmentId employment.status")
        .populate("departmentId", "name")
        .lean();

      const deptOf = new Map(
        (employees as any[]).map((e) => [
          e.displayName,
          e.departmentId?.name ?? "—",
        ])
      );

      console.log(
        `\n═══ ${org.name.toUpperCase()} ═══  /${org.slug}  ` +
          `(${memberships.length} people, ${org.address?.state})\n`
      );

      const byRole = new Map<string, any[]>();
      for (const m of memberships as any[]) {
        byRole.set(m.role, [...(byRole.get(m.role) ?? []), m]);
      }

      for (const role of ROLE_ORDER) {
        const rows = byRole.get(role) ?? [];
        if (!rows.length) continue;

        rows.sort((a, b) =>
          (a.userId?.email ?? "").localeCompare(b.userId?.email ?? "")
        );

        console.log(`  ${role}`);
        for (const m of rows) {
          const u = m.userId;
          if (!u) continue;
          const dept = deptOf.get(m.employeeId?.displayName) ?? "—";
          const suspended = m.status !== "active" ? "  [SUSPENDED — cannot sign in]" : "";
          console.log(
            `    ${u.email.padEnd(38)} ${String(u.name).padEnd(20)} ${String(dept).padEnd(18)}${suspended}`
          );
        }
        console.log();
      }
    }
  });

  console.log(
    "\n  Password = the email address, for every account above.\n" +
      "  ⚠ Local development only.\n"
  );

  await mongoose.disconnect();
}

main().catch(async (err) => {
  console.error("\n  ✕ Failed:", err?.message ?? err, "\n");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
