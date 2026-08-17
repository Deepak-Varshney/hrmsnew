// app/api/settings/route.ts — organisation profile.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { updateOrgProfile } from "@/lib/services/settingsService";

export const PATCH = withContext(async (req) => {
  const body = await req.json();
  const org = await updateOrgProfile(body);
  return NextResponse.json({ message: "Organisation details saved.", org });
});
