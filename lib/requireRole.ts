// lib/requireRole.ts
import { requireAuth } from "./requireAuth";

export async function requireHR(req: Request) {
  const { user } = await requireAuth(req);
  const role = (user as any).role;
  if (role !== "HR" && role !== "Admin") {
    throw new Error("Unauthorized: HR or Admin access required");
  }
  return { user };
}

export async function requireAdmin(req: Request) {
  const { user } = await requireAuth(req);
  const role = (user as any).role;
  if (role !== "Admin") {
    throw new Error("Unauthorized: Admin access required");
  }
  return { user };
}

