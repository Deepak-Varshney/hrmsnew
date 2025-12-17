// models/Policy.ts
import mongoose from "mongoose";

export interface IPolicy {
  title: string;
  category: "HR" | "IT" | "Compliance" | "Other";
  description?: string;
  fileUrl: string; // PDF file URL
  version: string;
  effectiveDate: Date;
  isActive: boolean;
  createdBy: mongoose.Types.ObjectId;
}

const PolicySchema = new mongoose.Schema<IPolicy>({
  title: { type: String, required: true },
  category: { type: String, enum: ["HR", "IT", "Compliance", "Other"], required: true },
  description: String,
  fileUrl: { type: String, required: true },
  version: { type: String, required: true },
  effectiveDate: { type: Date, required: true },
  isActive: { type: Boolean, default: true },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
}, { timestamps: true });

PolicySchema.index({ category: 1, isActive: 1 });

export default (mongoose.models.Policy as mongoose.Model<IPolicy>) || mongoose.model<IPolicy>("Policy", PolicySchema);

