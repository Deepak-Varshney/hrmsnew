// lib/mongoose.ts
//
// Cached connection. In dev, Next reloads modules on every change, so the
// connection is stashed on globalThis to avoid opening a new pool each time.

import mongoose from "mongoose";

// Registered at module scope, not inside connect(). connect() returns early
// when a connection is already cached — which, in dev, it usually is — so
// registering there would be skipped for the life of the process and
// populate() would keep throwing MissingSchemaError.
//
// Safe from cycles: model files import the plugins, and the plugins never
// import this module.
import "@/model/registry";

const MONGODB_URI = process.env.MONGODB_URI!;
if (!MONGODB_URI) throw new Error("Missing MONGODB_URI");

declare global {
  var _mongooseCache:
    | { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null }
    | undefined;
}

const cached = (globalThis._mongooseCache ??= { conn: null, promise: null });

export async function connect() {
  if (cached.conn) return cached.conn;

  // Single in-flight connection: concurrent callers await the same promise
  // rather than each opening their own.
  cached.promise ??= mongoose.connect(MONGODB_URI, {});

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    // Let the next call retry instead of caching a rejected promise forever.
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
