// app/api/auth/logout/route.ts
import { NextResponse } from "next/server";
import Session from "@/model/Session";
import jwt from "jsonwebtoken";
import { connect } from "@/lib/mongoose";

const JWT_SECRET = process.env.JWT_SECRET!;

export async function POST(req: Request) {
  try {
    const h = req.headers.get("authorization") || "";
    const token = h.split(" ")[1];
    if (!token) return NextResponse.json({ error: "No token provided" }, { status: 401 });

    const payload: any = jwt.verify(token, JWT_SECRET);
    await connect();
    await Session.findByIdAndUpdate(payload.sessionId, { active: false });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json({ error: "Invalid token or already logged out" }, { status: 401 });
  }
}
