// lib/requireAuth.ts
import { verifyTokenAndSession } from "./auth";

export async function requireAuth(req: Request) {
  const h = req.headers.get("authorization") || "";
  const token = h.split(" ")[1];
  if (!token) throw new Error("Unauthorized: missing token");
  const { user, session } = await verifyTokenAndSession(token);
  return { user, session };
}
