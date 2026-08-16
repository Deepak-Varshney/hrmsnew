// scripts/seed-super-admin.ts
//
// Creates the single platform Super Admin.
//
//   npm run seed:super-admin
//
// Credentials come from the environment and are never written to source:
//   SUPER_ADMIN_EMAIL=deepakvarshney.com@gmail.com
//   SUPER_ADMIN_PASSWORD=<strong password>
//
// Idempotent. Re-running reports the existing account and changes nothing
// unless --force-password is passed.
//
// The super admin has no Membership and belongs to no org — it is the
// `isSuperAdmin` flag on User, and it can read every tenant's data. Enable
// 2FA on it before this application handles real employee records.

import "dotenv/config";
import mongoose from "mongoose";
import { connect } from "../lib/mongoose";
import { runAsSystem } from "../lib/context";
import { hashPassword } from "../lib/auth";
import User from "../model/User";

const MIN_PASSWORD_LENGTH = 12;

function fail(message: string): never {
  console.error(`\n  ✕ ${message}\n`);
  process.exit(1);
}

async function main() {
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.SUPER_ADMIN_PASSWORD;
  const forcePassword = process.argv.includes("--force-password");

  if (!email) fail("SUPER_ADMIN_EMAIL is not set.");
  if (!password) fail("SUPER_ADMIN_PASSWORD is not set.");

  if (password.length < MIN_PASSWORD_LENGTH) {
    fail(
      `SUPER_ADMIN_PASSWORD must be at least ${MIN_PASSWORD_LENGTH} characters. ` +
        `This account can read every organization's employee PII.`
    );
  }

  await connect();

  // runAsSystem: no request context exists in a CLI script, and the seed must
  // not be tenant-scoped or activity-logged.
  await runAsSystem(async () => {
    const existingSuper = await User.findOne({ isSuperAdmin: true })
      .withDeleted()
      .lean();

    if (existingSuper && (existingSuper as any).email !== email) {
      fail(
        `A different super admin already exists: ${(existingSuper as any).email}\n` +
          `    There is exactly one super admin. Remove it deliberately before seeding another.`
      );
    }

    const existing = await User.findOne({ email }).withDeleted();

    if (existing) {
      let changed = false;

      if (!existing.isSuperAdmin) {
        existing.isSuperAdmin = true;
        changed = true;
      }
      if (existing.status !== "active") {
        existing.status = "active";
        changed = true;
      }
      if (existing.deletedAt) {
        existing.deletedAt = null;
        changed = true;
      }
      if (forcePassword) {
        existing.passwordHash = await hashPassword(password);
        existing.failedLoginAttempts = 0;
        existing.lockedUntil = null;
        changed = true;
      }

      if (changed) {
        await existing.save();
        console.log(`\n  ✓ Updated super admin: ${email}`);
        if (forcePassword) console.log("    Password reset.");
      } else {
        console.log(`\n  → Super admin already present: ${email}`);
        console.log("    Nothing to do. Pass --force-password to reset it.");
      }
    } else {
      await User.create({
        name: "Super Admin",
        email,
        passwordHash: await hashPassword(password),
        isSuperAdmin: true,
        status: "active",
        twoFactorEnabled: false,
      });
      console.log(`\n  ✓ Created super admin: ${email}`);
    }

    if (!(await User.findOne({ email }))?.twoFactorEnabled) {
      console.log(
        "\n  ! 2FA is not enabled on this account.\n" +
          "    It can read every organization's employee PII — a single leaked\n" +
          "    password is a full-platform breach. Enable 2FA before go-live."
      );
    }
  });

  await mongoose.disconnect();
  console.log("");
}

main().catch(async (err) => {
  console.error("\n  ✕ Seed failed:", err?.message ?? err, "\n");
  await mongoose.disconnect().catch(() => {});
  process.exit(1);
});
