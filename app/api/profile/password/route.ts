// app/api/profile/password/route.ts
//
// Password change for the signed-in user.
//
// Requires the current password even though the session already proves
// identity — it stops an unattended logged-in machine from becoming a
// permanent account takeover.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { getContext } from "@/lib/context";
import { comparePassword, hashPassword } from "@/lib/auth";
import { logActivity } from "@/lib/activity";
import User from "@/model/User";
import Session from "@/model/Session";

const MIN_LENGTH = 8;

export const POST = withContext(async (req) => {
  const ctx = getContext()!;
  const { currentPassword, newPassword, confirmPassword } = await req.json();

  if (!currentPassword || !newPassword) {
    return NextResponse.json(
      { error: "Enter your current and new password" },
      { status: 400 }
    );
  }
  if (newPassword !== confirmPassword) {
    return NextResponse.json({ error: "The new passwords do not match" }, { status: 400 });
  }
  if (String(newPassword).length < MIN_LENGTH) {
    return NextResponse.json(
      { error: `Use at least ${MIN_LENGTH} characters` },
      { status: 400 }
    );
  }
  if (currentPassword === newPassword) {
    return NextResponse.json(
      { error: "The new password must be different from the current one" },
      { status: 400 }
    );
  }

  const user = await User.findById(ctx.userId);
  if (!user) return NextResponse.json({ error: "Not found" }, { status: 404 });

  if (!(await comparePassword(currentPassword, user.passwordHash))) {
    await logActivity({
      action: "auth.password.change.failed",
      entityType: "User",
      entityId: user._id,
      entityLabel: user.email,
      severity: "warning",
    });
    return NextResponse.json({ error: "Current password is incorrect" }, { status: 400 });
  }

  user.passwordHash = await hashPassword(newPassword);
  await user.save();

  // Every other session is invalidated. If the password was changed because
  // it may have leaked, leaving other sessions alive defeats the point.
  await Session.updateMany(
    { userId: user._id, active: true },
    { active: false }
  );

  await logActivity({
    action: "auth.password.changed",
    entityType: "User",
    entityId: user._id,
    entityLabel: user.email,
    metadata: { otherSessionsRevoked: true },
    severity: "critical",
  });

  return NextResponse.json({
    message: "Password changed. You will need to sign in again.",
    signOutRequired: true,
  });
});
