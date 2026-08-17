// model/ChangeRequest.ts
//
// An employee's proposed edit to their own record, awaiting HR.
//
// Employees never write to Employee directly. Every self-service change lands
// here first, so HR can see what is being changed, from what, by whom, and
// approve or refuse it. Applying a request is what writes to Employee — which
// means the normal activity log and EmploymentHistory capture it as an HR
// action, with the request as provenance.
//
// ⚠ A pending request holds the proposed values, which can include bank
// details. Treat this collection with the same care as Employee itself.

import mongoose, { Schema } from "mongoose";
import { tenantModel } from "@/lib/db/plugins";

export type ChangeRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface IChangeField {
  /** Dot path on Employee, e.g. "contact.personalPhone". */
  path: string;
  /** Human label for the review screen. */
  label: string;
  oldValue?: any;
  newValue?: any;
  /** Values that must be masked when displayed. */
  sensitive?: boolean;
}

export interface IChangeRequest {
  orgId: mongoose.Types.ObjectId;
  employeeId: mongoose.Types.ObjectId;
  requestedBy: mongoose.Types.ObjectId;
  requestedByName: string;

  fields: IChangeField[];
  note?: string;

  status: ChangeRequestStatus;
  reviewedBy?: mongoose.Types.ObjectId | null;
  reviewedByName?: string | null;
  reviewedAt?: Date | null;
  reviewNote?: string | null;

  deletedAt?: Date | null;
}

const ChangeFieldSchema = new Schema<IChangeField>(
  {
    path: { type: String, required: true },
    label: { type: String, required: true },
    oldValue: Schema.Types.Mixed,
    newValue: Schema.Types.Mixed,
    sensitive: { type: Boolean, default: false },
  },
  { _id: false }
);

const ChangeRequestSchema = new Schema<IChangeRequest>(
  {
    employeeId: {
      type: Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    requestedBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    requestedByName: { type: String, required: true },

    fields: { type: [ChangeFieldSchema], default: [] },
    note: String,

    status: {
      type: String,
      enum: ["pending", "approved", "rejected", "cancelled"],
      default: "pending",
      index: true,
    },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "User", default: null },
    reviewedByName: { type: String, default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },
  },
  {
    timestamps: true,
    activityLabel: (d: any) =>
      `${d.fields?.length ?? 0} field change for ${d.requestedByName}`,
  } as any
);

// The HR queue, and an employee's own history.
ChangeRequestSchema.index({ orgId: 1, status: 1, createdAt: -1 });
ChangeRequestSchema.index({ orgId: 1, employeeId: 1, createdAt: -1 });

ChangeRequestSchema.plugin(tenantModel);

export default (mongoose.models.ChangeRequest as mongoose.Model<IChangeRequest>) ||
  mongoose.model<IChangeRequest>("ChangeRequest", ChangeRequestSchema);
