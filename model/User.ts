// models/User.ts
import mongoose from "mongoose";

export interface IUser {
  name: string;
  email: string;
  passwordHash: string;
  role: "Employee"|"Manager"|"HR"|"Admin";
  isActive: boolean;
}

const UserSchema = new mongoose.Schema<IUser>({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  role: { type: String, enum: ['Employee','Manager','HR','Admin'], default: 'Employee' },
  isActive: { type: Boolean, default: true },
}, { timestamps: true });

export default (mongoose.models.User as mongoose.Model<IUser>) || mongoose.model<IUser>('User', UserSchema);
