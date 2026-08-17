// app/api/change-requests/route.ts

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import { listChangeRequests } from "@/lib/services/changeRequests";

export const GET = withContext(async (req) => {
  const status = new URL(req.url).searchParams.get("status") ?? undefined;
  return NextResponse.json({ requests: await listChangeRequests(status) });
});
