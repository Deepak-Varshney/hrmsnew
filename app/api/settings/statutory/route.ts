// app/api/settings/statutory/route.ts — PF, ESI, PT, TDS, LWF and gratuity.
//
// ⚠ Changing these changes what people are paid. Every write is logged as
// critical, and payroll reads the config effective on the pay date, so a past
// month still recomputes to the number it produced at the time.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import {
  loadStatutoryConfig,
  updateStatutoryConfig,
} from "@/lib/services/settingsService";

export const GET = withContext(async (req) => {
  const fy = new URL(req.url).searchParams.get("fy") ?? undefined;
  return NextResponse.json({ config: await loadStatutoryConfig(fy) });
});

export const PATCH = withContext(async (req) => {
  const { financialYear, ...sections } = await req.json();
  const config = await updateStatutoryConfig(financialYear, sections);
  return NextResponse.json({
    message: `Statutory settings saved for FY ${config.financialYear}.`,
    config,
  });
});
