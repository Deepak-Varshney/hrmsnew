// models/Employee.ts
import mongoose from "mongoose";

export interface IEmployee {
  userId: mongoose.Types.ObjectId; // Reference to User
  employeeCode?: string;
  department?: string;
  designation?: string;
  managerId?: mongoose.Types.ObjectId; // Reporting manager
  joiningDate?: Date;
  phone?: string;
  address?: string;
  emergencyContact?: {
    name: string;
    relation: string;
    phone: string;
  };
}

const EmployeeSchema = new mongoose.Schema<IEmployee>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  employeeCode: String,
  department: String,
  designation: String,
  managerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  joiningDate: Date,
  phone: String,
  address: String,
  emergencyContact: {
    name: String,
    relation: String,
    phone: String,
  },
}, { timestamps: true });

EmployeeSchema.index({ employeeCode: 1 }, { unique: true, sparse: true });
EmployeeSchema.index({ managerId: 1 });

export default (mongoose.models.Employee as mongoose.Model<IEmployee>) || mongoose.model<IEmployee>("Employee", EmployeeSchema);

