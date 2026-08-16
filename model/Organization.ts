// model/Organization.ts
//
// The tenant. Every other tenant-owned document points at one of these via
// `orgId`, and the slug is the tenant key in the URL: /[orgSlug]/employees
//
// Not tenant-scoped itself (it *is* the tenant), but soft-deleted and audited
// like everything else.

import mongoose, { Schema } from "mongoose";
import { platformModel } from "@/lib/db/plugins";

export type OrgStatus = "trial" | "active" | "suspended";

export interface IOrganization {
  name: string;
  /** URL key, e.g. "acme" → /acme/employees. Unique across the platform. */
  slug: string;
  legalName?: string;
  logo?: string;
  status: OrgStatus;

  timezone: string;
  currency: string;
  /** 1–12. India's financial year starts in April. */
  fiscalYearStartMonth: number;

  employeeCodePrefix: string;
  employeeCodeSeq: number;

  contact?: { email?: string; phone?: string };
  address?: {
    line1?: string;
    line2?: string;
    city?: string;
    state?: string;
    country?: string;
    pincode?: string;
  };

  /** India statutory registration identifiers. */
  statutory?: {
    pan?: string;
    tan?: string;
    gstin?: string;
    pfCode?: string;
    esicCode?: string;
  };

  settings: {
    /**
     * When true, org admins may restore items they soft-deleted within
     * `adminRestoreWindowDays`. Off by default: restore is Super Admin only.
     * Permanent delete is Super Admin only regardless of this setting.
     */
    allowAdminRestore: boolean;
    adminRestoreWindowDays: number;
  };

  deletedAt?: Date | null;
}

const OrganizationSchema = new Schema<IOrganization>(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      match: [
        /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/,
        "Slug must be 3-40 chars, lowercase alphanumeric and hyphens, not starting or ending with a hyphen.",
      ],
    },
    legalName: { type: String, trim: true },
    logo: String,
    status: {
      type: String,
      enum: ["trial", "active", "suspended"],
      default: "trial",
      index: true,
    },

    timezone: { type: String, default: "Asia/Kolkata" },
    currency: { type: String, default: "INR" },
    fiscalYearStartMonth: { type: Number, default: 4, min: 1, max: 12 },

    employeeCodePrefix: { type: String, default: "EMP", trim: true, uppercase: true },
    employeeCodeSeq: { type: Number, default: 0 },

    contact: {
      email: { type: String, trim: true, lowercase: true },
      phone: { type: String, trim: true },
    },
    address: {
      line1: String,
      line2: String,
      city: String,
      state: String,
      country: { type: String, default: "India" },
      pincode: String,
    },

    statutory: {
      pan: { type: String, trim: true, uppercase: true },
      tan: { type: String, trim: true, uppercase: true },
      gstin: { type: String, trim: true, uppercase: true },
      pfCode: { type: String, trim: true },
      esicCode: { type: String, trim: true },
    },

    settings: {
      allowAdminRestore: { type: Boolean, default: false },
      adminRestoreWindowDays: { type: Number, default: 30 },
    },
  },
  {
    timestamps: true,
    activityLabel: (doc: any) => `${doc.name} (${doc.slug})`,
  } as any
);

// Reserved slugs would collide with platform routes.
const RESERVED_SLUGS = new Set([
  "admin",
  "api",
  "auth",
  "login",
  "logout",
  "register",
  "me",
  "settings",
  "static",
  "public",
  "_next",
  "www",
  "app",
  "support",
  "help",
]);

// Mongoose 9 pre-hooks take (this, opts) — there is no `next` callback in the
// typed signature. Throw to reject.
OrganizationSchema.pre("validate", function (this: any) {
  if (this.slug && RESERVED_SLUGS.has(this.slug)) {
    throw new Error(`"${this.slug}" is a reserved slug.`);
  }
});

// Unique among live orgs only, so a deleted org's slug can be reused.
OrganizationSchema.index(
  { slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);

OrganizationSchema.plugin(platformModel);

export default (mongoose.models.Organization as mongoose.Model<IOrganization>) ||
  mongoose.model<IOrganization>("Organization", OrganizationSchema);
