// lib/auth.ts
import bcrypt from "bcrypt";
import jwt, { SignOptions } from "jsonwebtoken";
import { connect } from "./mongoose";
import mongoose from "mongoose";
import Session from "@/model/Session";
import User from "@/model/User";

const JWT_SECRET = process.env.JWT_SECRET || "";
if (!JWT_SECRET) throw new Error("JWT_SECRET is required in .env.local");

// FIX: correct typing for expiresIn
const JWT_EXPIRES_IN: SignOptions["expiresIn"] =
  (process.env.JWT_EXPIRES_IN as SignOptions["expiresIn"]) || "1h";

const SESSION_TTL_DAYS = Number(process.env.SESSION_TTL_DAYS || 30);

export async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

export async function comparePassword(plain: string, hash: string) {
  return bcrypt.compare(plain, hash);
}

/**
 * Create a server-side session (deactivates any existing active sessions for the user)
 * and return a signed JWT containing userId and sessionId.
 */
export async function createSessionAndToken(
  userId: mongoose.Types.ObjectId,
  ua?: string,
  ip?: string
) {
  await connect();

  // Invalidate previous sessions (single active session)
  await Session.updateMany({ userId, active: true }, { active: false });

  const expiresAt = new Date(
    Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000
  );

  const session = await Session.create({
    userId,
    ua,
    ip,
    active: true,
    expiresAt,
  });

  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN,
  };

  const token = jwt.sign(
    {
      userId: userId.toString(),
      sessionId: session._id.toString(),
    },
    JWT_SECRET,
    options
  );

  return { token, session };
}

/**
 * Verify JWT signature then confirm session is still active and not expired.
 * Throws on any problem.
 */
export async function verifyTokenAndSession(token: string) {
  await connect();

  const payload = jwt.verify(token, JWT_SECRET) as {
    userId: string;
    sessionId: string;
  };

  const { userId, sessionId } = payload;
  if (!userId || !sessionId) throw new Error("Invalid token payload");

  const session = await Session.findById(sessionId);
  if (!session || !session.active)
    throw new Error("Session invalid or logged out");

  if (session.expiresAt && session.expiresAt < new Date())
    throw new Error("Session expired");

  const user = await User.findById(userId).lean();
  if (!user || !(user as any).isActive)
    throw new Error("User disabled or not found");

  return { user, session };
}
