// models/Session.ts
import mongoose from "mongoose";

export interface ISession {
  userId: mongoose.Types.ObjectId;
  ua?: string;
  ip?: string;
  active: boolean;
  expiresAt?: Date;
}

const SessionSchema = new mongoose.Schema<ISession>({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  ua: String,
  ip: String,
  active: { type: Boolean, default: true },
  expiresAt: Date,
}, { timestamps: true });

export default (mongoose.models.Session as mongoose.Model<ISession>) || mongoose.model<ISession>('Session', SessionSchema);
