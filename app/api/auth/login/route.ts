// app/api/auth/login/route.ts
import { NextResponse } from "next/server";
import { connect } from "@/lib/mongoose";
import User from "@/model/User";
import {
  SESSION_COOKIE,
  comparePassword,
  createSessionAndToken,
  sessionCookieOptions,
} from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import { runAsSystem } from "@/lib/context";

/** Lock an account after repeated failures, for a short cool-off. */
const MAX_ATTEMPTS = 8;
const LOCK_MINUTES = 15;

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ error: "Enter your email and password" }, { status: 400 });
    }

    await connect();
    const user = await User.findOne({ email: String(email).toLowerCase() });

    // Same message whether the account exists or the password is wrong —
    // otherwise this endpoint tells an attacker which emails are registered.
    const invalid = () =>
      NextResponse.json({ error: "Invalid email or password" }, { status: 401 });

    if (!user) return invalid();

    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const minutes = Math.ceil((user.lockedUntil.getTime() - Date.now()) / 60000);
      return NextResponse.json(
        { error: `Too many attempts. Try again in ${minutes} minute(s).` },
        { status: 429 }
      );
    }

    if (user.status === "suspended") {
      return NextResponse.json(
        { error: "This account is suspended. Contact your HR administrator." },
        { status: 403 }
      );
    }

    const ok = await comparePassword(password, user.passwordHash);

    if (!ok) {
      user.failedLoginAttempts = (user.failedLoginAttempts ?? 0) + 1;
      if (user.failedLoginAttempts >= MAX_ATTEMPTS) {
        user.lockedUntil = new Date(Date.now() + LOCK_MINUTES * 60_000);
        user.failedLoginAttempts = 0;
      }
      await user.save();

      await runAsSystem(() =>
        logActivity({
          action: "auth.login.failed",
          entityType: "User",
          entityId: user._id,
          entityLabel: user.email,
          severity: "warning",
        })
      );

      return invalid();
    }

    user.failedLoginAttempts = 0;
    user.lockedUntil = null;
    user.lastLoginAt = new Date();
    await user.save();

    const ua = req.headers.get("user-agent") || undefined;
    const ip = req.headers.get("x-forwarded-for") || undefined;
    const { token } = await createSessionAndToken(user._id, ua, ip);

    const res = NextResponse.json({
      // Still returned so any client code still reading localStorage keeps
      // working while the app migrates to server-side rendering.
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        isSuperAdmin: user.isSuperAdmin,
      },
    });

    // The cookie is what server components read — localStorage is invisible
    // to them.
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions());
    return res;
  } catch (err: any) {
    console.error("[auth/login]", err);
    return NextResponse.json({ error: "Could not sign you in" }, { status: 500 });
  }
}
