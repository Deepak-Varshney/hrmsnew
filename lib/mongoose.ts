// lib/mongoose.ts
import mongoose from "mongoose";

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

declare global { var _mongooseCache: { conn: typeof mongoose | null } | undefined; }
let cached = (global as any)._mongooseCache || { conn: null };
if (!cached.conn) (global as any)._mongooseCache = cached;

export async function connect() {
  if (cached.conn) return cached.conn;
  const conn = await mongoose.connect(MONGODB_URI, {});
  cached.conn = conn;
  return conn;
}
