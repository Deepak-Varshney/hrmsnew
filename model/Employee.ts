// model/Employee.ts
//
// The core HR record.
//
// Grouped into blocks (contact / statutory / bank / employment / exit) rather
// than a flat field list, because access control is applied per block:
// `statutory` and `bank` are stripped for anyone without employee.pii.read.
// Always output through serializeEmployee() — never return a raw document.
//
// MIGRATION NOTE: `managerId` (→ User) is the legacy single-tenant field.
// `reportsTo` (→ Employee) is the real reporting edge and is what
// $graphLookup walks for manager scope. Until the migration backfills
// reportsTo, manager scope resolves to self only — which fails closed, not
// open, and is the correct direction to fail.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";
import { encryptedString } from "@/lib/crypto";

export type EmploymentType =
  | "full-time"
  | "part-time"
  | "contract"
  | "intern"
  | "consultant";
export type WorkMode = "onsite" | "remote" | "hybrid";
export type EmployeeStatus =
  | "probation"
  | "active"
  | "notice-period"
  | "on-leave"
  | "exited";
export type ExitType =
  | "resignation"
  | "termination"
  | "end-of-contract"
  | "retirement"
  | "absconding";

const AddressSchema = new Schema(
  {
    line1: String,
    line2: String,
    city: String,
    state: String,
    country: { type: String, default: "India" },
    pincode: String,
  },
  { _id: false }
);

const EmployeeSchema = new Schema(
  {
    /** Login identity. Null for employees who have no portal access yet. */
    userId: { type: Schema.Types.ObjectId, ref: "User", default: null, index: true },

    // ---- Identity -------------------------------------------------------
    employeeCode: { type: String, required: true, trim: true, uppercase: true },
    firstName: { type: String, required: true, trim: true },
    middleName: { type: String, trim: true },
    lastName: { type: String, trim: true },
    /** Derived in pre-validate; kept denormalized for search and display. */
    displayName: { type: String, trim: true, index: true },
    photo: { type: String, default: null },
    dateOfBirth: Date,
    gender: { type: String, enum: ["male", "female", "other", "undisclosed"] },
    bloodGroup: String,
    maritalStatus: {
      type: String,
      enum: ["single", "married", "divorced", "widowed", "undisclosed"],
    },
    nationality: { type: String, default: "Indian" },

    // ---- Contact --------------------------------------------------------
    contact: {
      workEmail: { type: String, trim: true, lowercase: true },
      personalEmail: { type: String, trim: true, lowercase: true },
      workPhone: { type: String, trim: true },
      personalPhone: { type: String, trim: true },
      currentAddress: { type: AddressSchema, default: undefined },
      permanentAddress: { type: AddressSchema, default: undefined },
      permanentSameAsCurrent: { type: Boolean, default: false },
    },

    emergencyContacts: [
      {
        _id: false,
        name: String,
        relationship: String,
        phone: String,
        altPhone: String,
        address: String,
        isPrimary: { type: Boolean, default: false },
      },
    ],

    // ---- Statutory (India) — PII, encrypted at rest ---------------------
    statutory: {
      pan: encryptedString,
      aadhaar: encryptedString,
      uan: encryptedString,
      pfNumber: { type: String, default: null },
      esicNumber: { type: String, default: null },
    },

    // ---- Bank — PII, account number encrypted at rest -------------------
    bank: {
      accountHolderName: { type: String, default: null },
      accountNumber: encryptedString,
      ifsc: { type: String, default: null, uppercase: true, trim: true },
      bankName: { type: String, default: null },
      branch: { type: String, default: null },
    },

    // ---- Employment -----------------------------------------------------
    employment: {
      dateOfJoining: { type: Date, required: true },
      probationMonths: { type: Number, default: 6 },
      probationEndDate: Date,
      confirmationDate: Date,
      employmentType: {
        type: String,
        enum: ["full-time", "part-time", "contract", "intern", "consultant"],
        default: "full-time",
      },
      workMode: {
        type: String,
        enum: ["onsite", "remote", "hybrid"],
        default: "onsite",
      },
      status: {
        type: String,
        enum: ["probation", "active", "notice-period", "on-leave", "exited"],
        default: "probation",
        index: true,
      },
    },

    departmentId: { type: Schema.Types.ObjectId, ref: "Department", default: null },
    designationId: { type: Schema.Types.ObjectId, ref: "Designation", default: null },
    locationId: { type: Schema.Types.ObjectId, ref: "Location", default: null },
    gradeId: { type: Schema.Types.ObjectId, ref: "Grade", default: null },
    costCenter: { type: String, default: null },

    /** The reporting edge. Manager scope walks this with $graphLookup. */
    reportsTo: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
      index: true,
    },
    dottedLineManagerId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      default: null,
    },

    /** @deprecated Legacy single-tenant field referencing User. Use reportsTo. */
    managerId: { type: Schema.Types.ObjectId, ref: "User", default: null },

    // ---- Exit -----------------------------------------------------------
    exit: {
      resignationDate: Date,
      lastWorkingDay: Date,
      noticePeriodDays: Number,
      exitType: {
        type: String,
        enum: [
          "resignation",
          "termination",
          "end-of-contract",
          "retirement",
          "absconding",
        ],
      },
      exitReason: String,
      rehireEligible: { type: Boolean, default: true },
      exitInterviewCompleted: { type: Boolean, default: false },
    },

    // ---- Background -----------------------------------------------------
    education: [
      {
        _id: false,
        degree: String,
        specialization: String,
        institution: String,
        yearOfPassing: Number,
        grade: String,
      },
    ],
    previousEmployment: [
      {
        _id: false,
        company: String,
        designation: String,
        from: Date,
        to: Date,
        reasonForLeaving: String,
      },
    ],
    family: [
      {
        _id: false,
        name: String,
        relationship: String,
        dateOfBirth: Date,
        isDependent: { type: Boolean, default: false },
        isNominee: { type: Boolean, default: false },
      },
    ],
    skills: { type: [String], default: [] },
    certifications: [
      {
        _id: false,
        name: String,
        issuedBy: String,
        issuedOn: Date,
        expiresOn: Date,
        credentialId: String,
      },
    ],

    /** Per-org extra fields, defined in Settings → Custom Fields. */
    customFields: { type: Map, of: Schema.Types.Mixed, default: {} },
  },
  {
    timestamps: true,
    // Getters decrypt statutory/bank on read. Note .lean() skips getters and
    // returns ciphertext — which fails safe, but means lean() must not be
    // used on paths that display PII.
    toObject: { getters: true },
    toJSON: { getters: true },
    activityLabel: (d: any) => `${d.displayName ?? d.firstName} (${d.employeeCode})`,
  } as any
);

EmployeeSchema.pre("validate", function (this: any) {
  if (!this.displayName) {
    this.displayName = [this.firstName, this.middleName, this.lastName]
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  // Derive probation end from joining date when not set explicitly.
  if (
    this.employment?.dateOfJoining &&
    this.employment?.probationMonths &&
    !this.employment.probationEndDate
  ) {
    const end = new Date(this.employment.dateOfJoining);
    end.setMonth(end.getMonth() + this.employment.probationMonths);
    this.employment.probationEndDate = end;
  }

  // An employee cannot report to themselves. Deeper cycles are checked in the
  // service layer, which can walk the chain.
  if (this.reportsTo && String(this.reportsTo) === String(this._id)) {
    throw new Error("An employee cannot report to themselves.");
  }
});

// Scoped uniqueness — codes and work emails are unique per org, not globally.
EmployeeSchema.index(
  { orgId: 1, employeeCode: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } }
);
EmployeeSchema.index(
  { orgId: 1, "contact.workEmail": 1 },
  {
    unique: true,
    partialFilterExpression: {
      deletedAt: null,
      "contact.workEmail": { $type: "string" },
    },
  }
);

// List filtering
EmployeeSchema.index({ orgId: 1, "employment.status": 1, departmentId: 1 });
EmployeeSchema.index({ orgId: 1, locationId: 1 });
EmployeeSchema.index({ orgId: 1, "employment.dateOfJoining": -1 });
// Directory / global search
EmployeeSchema.index({
  displayName: "text",
  employeeCode: "text",
  "contact.workEmail": "text",
});

EmployeeSchema.plugin(tenantModel);

export default (mongoose.models.Employee as mongoose.Model<any>) ||
  mongoose.model("Employee", EmployeeSchema);
