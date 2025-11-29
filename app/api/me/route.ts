// app/api/me/route.ts
import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/requireAuth";

export async function GET(req: Request) {
  try {
    const { user } = await requireAuth(req);
    const safe = { id: (user as any)._id, name: (user as any).name, email: (user as any).email, role: (user as any).role };
    return NextResponse.json({ user: safe });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Unauthorized" }, { status: 401 });
  }
}
