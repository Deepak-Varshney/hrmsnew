// app/api/auth/register/route.ts
import { NextResponse } from "next/server";
import { connect } from "@/lib/mongoose";
import { hashPassword, createSessionAndToken } from "@/lib/auth";
import User from "@/model/User";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, email, password, role } = body;
    if (!name || !email || !password) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

    await connect();
    const exists = await User.findOne({ email });
    if (exists) return NextResponse.json({ error: "User already exists" }, { status: 409 });

    const passwordHash = await hashPassword(password);
    const user = await User.create({ name, email, passwordHash, role: role || "Employee" });

    const ua = req.headers.get("user-agent") || undefined;
    const ip = req.headers.get("x-forwarded-for") || undefined;

    const { token } = await createSessionAndToken(user._id, ua, ip);

    return NextResponse.json({
      token,
      user: { id: user._id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Server error" }, { status: 500 });
  }
}
