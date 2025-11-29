// scripts/seed-admin.ts
import { connect } from "../lib/mongoose";
import { hashPassword } from "../lib/auth";
import User from "@/model/User";

async function run(){
  await connect();
  const existing = await User.findOne({ email: "admin@company.local" });
  if (existing) { console.log("Admin exists"); process.exit(0); }
  const passwordHash = await hashPassword("Admin@123");
  const user = await User.create({ name: "Admin", email: "admin@company.local", passwordHash, role: "Admin" });
  console.log("Created admin:", user._id);
  process.exit(0);
}

run().catch(e=>{ console.error(e); process.exit(1); });
