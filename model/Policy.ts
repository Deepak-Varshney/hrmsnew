// models/Policy.ts
//
// A policy is either written inline (`content`) or attached as a document
// (`fileUrl`). The original schema required fileUrl and constrained category
// to a four-value enum, which the real content did not fit — categories in
// practice are things like "Attendance" and "Leave", and most policies are
// short enough to read in the page rather than download.
//
// MIGRATION NOTE: legacy model. orgId is declared so new writes are
// tenant-stamped — without the field Mongoose's strict mode drops it
// silently on save.

import mongoose from "mongoose";

export interface IPolicy {
  orgId?: mongoose.Types.ObjectId;
  title: string;
  /** Free text, e.g. "Attendance", "Leave", "Workplace". */
  category?: string;
  /** The policy itself, when written inline. */
  content?: string;
  description?: string;
  /** Cloudinary key or URL, when the policy is a document. */
  fileUrl?: string;
  version?: string;
  effectiveDate?: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
  deletedAt?: Date | null;
}

const PolicySchema = new mongoose.Schema<IPolicy>(
  {
    orgId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      index: true,
    },
    title: { type: String, required: true },
    category: { type: String, default: "General" },
    content: String,
    description: String,
    fileUrl: String,
    version: String,
    effectiveDate: Date,
    isActive: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

PolicySchema.index({ orgId: 1, category: 1, isActive: 1 });

export default (mongoose.models.Policy as mongoose.Model<IPolicy>) ||
  mongoose.model<IPolicy>("Policy", PolicySchema);
