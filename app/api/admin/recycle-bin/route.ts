// app/api/admin/recycle-bin/route.ts
//
// Restore and permanent delete. Both are Super Admin only, enforced in the
// service rather than here so the same rules apply however they are called.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { purgeRecord, restoreRecord } from "@/lib/db/purge";

export const POST = withContext(
  async (req) => {
    const { action, entityType, id, confirmLabel } = await req.json();

    if (action === "restore") {
      await restoreRecord(entityType, id);
      return NextResponse.json({ message: "Restored." });
    }

    if (action === "purge") {
      const { label } = await purgeRecord(entityType, id, confirmLabel);
      return NextResponse.json({ message: `"${label}" permanently deleted.` });
    }

    return NextResponse.json(
      { error: "action must be restore or purge" },
      { status: 400 },
    );
  },
  { superAdminOnly: true, allowNoOrg: true },
);
