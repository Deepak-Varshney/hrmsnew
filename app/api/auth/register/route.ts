// app/api/auth/register/route.ts
import { NextResponse } from "next/server";

// Registration is disabled - only admins can create users through the employees API
export async function POST(req: Request) {
  return NextResponse.json({ error: "Registration is disabled. Please contact an administrator." }, { status: 403 });
}
