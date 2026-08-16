// model/User.ts
//
// A global identity. Email is unique across the whole platform, not per-org.
//
// Role does NOT live here — it lives on Membership, so one person can hold
// different roles in different organizations. The one exception is
// `isSuperAdmin`, the platform role, which is checked before any org is
// resolved and can never be granted through the UI.

import mongoose, { Schema } from "mongoose";
import { platformModel } from "@/lib/db/plugins";

export type UserStatus = "active" | "suspended";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  avatar?: string | null;
  status: UserStatus;

  /**
   * Platform Super Admin. Exactly one exists, created by scripts/seed-super-admin.
   * Never settable through any API route.
   */
  isSuperAdmin: boolean;

  // Two-factor. Mandatory for the super admin account — it can read every
  // org's employee PII, so a single leaked password must not be enough.
  twoFactorEnabled: boolean;
  twoFactorSecret?: string | null;

  // Brute-force protection
  failedLoginAttempts: number;
  lockedUntil?: Date | null;
  lastLoginAt?: Date | null;

  /**
   * @deprecated Single-tenant leftover. Role now lives on Membership.
   * Retained only so legacy routes keep working until they are migrated;
   * scripts/migrate-to-multi-tenant reads it to build Memberships.
   * Do not read this in new code.
   */
  role?: "Employee" | "Manager" | "HR" | "Admin";

  /** @deprecated Use `status`. */
  isActive?: boolean;

  deletedAt?: Date | null;
}

const UserSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    passwordHash: { type: String, required: true },
    avatar: { type: String, default: null },
    status: {
      type: String,
      enum: ["active", "suspended"],
      default: "active",
      index: true,
    },

    isSuperAdmin: { type: Boolean, default: false },

    twoFactorEnabled: { type: Boolean, default: false },
    twoFactorSecret: { type: String, default: null, select: false },

    failedLoginAttempts: { type: Number, default: 0 },
    lockedUntil: { type: Date, default: null },
    lastLoginAt: { type: Date, default: null },

    // Deprecated — see interface notes.
    role: {
      type: String,
      enum: ["Employee", "Manager", "HR", "Admin"],
      default: "Employee",
    },
    isActive: { type: Boolean, default: true },
  },
  {
    timestamps: true,
    activityLabel: (doc: any) => `${doc.name} <${doc.email}>`,
  } as any
);

/** Never serialize secrets, even if a route forgets to project them out. */
UserSchema.set("toJSON", {
  transform: (_doc, ret: any) => {
    delete ret.passwordHash;
    delete ret.twoFactorSecret;
    return ret;
  },
});

UserSchema.index({ isSuperAdmin: 1 });

UserSchema.plugin(platformModel);

export default (mongoose.models.User as mongoose.Model<IUser>) ||
  mongoose.model<IUser>("User", UserSchema);
