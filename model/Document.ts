// model/Document.ts
//
// Employee documents, split by who owns them:
//
//   personal  — uploaded by the employee (Aadhaar, PAN, degree certificates)
//   company   — issued by the company (offer letter, appraisal, experience)
//
// The Profile page shows these as two separate cards, because the employee
// can add to one and only read the other.
//
// ⚠ Upload to Cloudinary with type: "authenticated" and serve via short-lived
// signed URLs. Cloudinary's default delivery is PUBLIC — an Aadhaar scan on a
// guessable URL is a breach, and nothing in this schema prevents it. The
// upload service is where that is enforced.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export type DocumentSource = "personal" | "company";
export type VerificationStatus = "pending" | "verified" | "rejected";

export interface IDocument {
  orgId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;

  source: DocumentSource;
  category: string;
  name: string;

  /** Cloudinary public_id of an `authenticated` asset. Never a public URL. */
  storageKey: string;
  /** Cloudinary format (pdf, png…). The download signature is computed over it. */
  format?: string;
  /** Cloudinary resource_type — image, raw or video. Needed to build the URL. */
  resourceType?: string;
  mimeType?: string;
  sizeBytes?: number;

  issueDate?: Date | null;
  expiryDate?: Date | null;

  verificationStatus: VerificationStatus;
  verifiedBy?: mongoose.Types.ObjectId | null;
  verifiedAt?: Date | null;
  rejectionReason?: string | null;

  uploadedBy?: mongoose.Types.ObjectId | null;
  deletedAt?: Date | null;
}

const DocumentSchema = new Schema<IDocument>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    source: {
      type: String,
      enum: ["personal", "company"],
      required: true,
      index: true,
    },
    category: { type: String, required: true, trim: true },
    name: { type: String, required: true, trim: true },

    storageKey: { type: String, required: true },
    format: String,
    resourceType: { type: String, default: "image" },
    mimeType: String,
    sizeBytes: Number,

    issueDate: { type: Date, default: null },
    expiryDate: { type: Date, default: null },

    verificationStatus: {
      type: String,
      enum: ["pending", "verified", "rejected"],
      default: "pending",
    },
    verifiedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    verifiedAt: { type: Date, default: null },
    rejectionReason: { type: String, default: null },

    uploadedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, activityLabel: (d: any) => d.name } as any
);

DocumentSchema.index({ orgId: 1, employeeId: 1, source: 1 });
// Drives the expiry dashboard and the daily reminder job.
DocumentSchema.index({ orgId: 1, expiryDate: 1 });

DocumentSchema.plugin(tenantModel);

export default (mongoose.models.Document as mongoose.Model<IDocument>) ||
  mongoose.model<IDocument>("Document", DocumentSchema);
