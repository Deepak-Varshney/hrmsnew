// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { cookies } from "next/headers";
import Session from "@/model/Session";
import { connect } from "@/lib/mongoose";
import { SESSION_COOKIE } from "@/lib/auth";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: Request) {
  // Clear the cookie regardless of what happens below. A sign-out request
  // must never leave the browser holding a usable session.
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SESSION_COOKIE, "", { path: "/", maxAge: 0 });

  try {
    const header = req.headers.get("authorization") ?? "";
    const store = await cookies();
    const token = header.split(" ")[1] || store.get(SESSION_COOKIE)?.value;
    if (!token) return res;

    const payload: any = jwt.verify(token, JWT_SECRET);
    await connect();
    await Session.findByIdAndUpdate(payload.sessionId, { active: false });
  } catch {
    // Already expired or revoked — the cookie is cleared either way.
  }

  return res;
}
