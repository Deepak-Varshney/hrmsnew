// app/api/settings/masters/route.ts
//
// Departments, designations, grades and locations. Permission is asserted in
// the service so the same rules apply however these are called.

import { NextResponse } from "next/server";
import { withContext } from "@/lib/withContext";
import {
  createMaster,
  deleteMaster,
  listMasters,
  updateMaster,
} from "@/lib/services/settingsService";

export const GET = withContext(async () => {
  return NextResponse.json({ masters: await listMasters() });
});

export const POST = withContext(async (req) => {
  const { kind, ...input } = await req.json();
  const created = await createMaster(kind, input);
  return NextResponse.json(
    { message: `"${created.label}" added.`, item: created },
    { status: 201 },
  );
});

export const PATCH = withContext(async (req) => {
  const { kind, id, ...input } = await req.json();
  const updated = await updateMaster(kind, id, input);
  return NextResponse.json({ message: "Saved.", item: updated });
});

export const DELETE = withContext(async (req) => {
  const { kind, id } = await req.json();
  const { label } = await deleteMaster(kind, id);
  return NextResponse.json({ message: `"${label}" removed.` });
});
