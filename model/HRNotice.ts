// model/HRNotice.ts
//
// A notice addressed to one employee — an appreciation, a warning, a policy
// memo, a confirmation letter.
//
// Distinct from Announcement, which goes to everyone. These are personal and
// part of someone's record, so they carry an acknowledgement: HR needs to be
// able to show that the employee saw it.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export type NoticeType =
  | "appreciation"
  | "warning"
  | "memo"
  | "confirmation"
  | "general";

export interface IHRNotice {
  orgId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;

  type: NoticeType;
  title: string;
  body: string;

  issuedBy?: mongoose.Types.ObjectId | null;
  issuedByName?: string | null;
  issuedAt: Date;

  /** Requires the employee to confirm they have read it. */
  requiresAcknowledgement: boolean;
  acknowledgedAt?: Date | null;

  deletedAt?: Date | null;
}

const HRNoticeSchema = new Schema<IHRNotice>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: ["appreciation", "warning", "memo", "confirmation", "general"],
      default: "general",
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },

    issuedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    issuedByName: { type: String, default: null },
    issuedAt: { type: Date, default: () => new Date() },

    requiresAcknowledgement: { type: Boolean, default: false },
    acknowledgedAt: { type: Date, default: null },
  },
  { timestamps: true, activityLabel: (d: any) => d.title } as any
);

HRNoticeSchema.index({ orgId: 1, employeeId: 1, issuedAt: -1 });

HRNoticeSchema.plugin(tenantModel);

export default (mongoose.models.HRNotice as mongoose.Model<IHRNotice>) ||
  mongoose.model<IHRNotice>("HRNotice", HRNoticeSchema);
