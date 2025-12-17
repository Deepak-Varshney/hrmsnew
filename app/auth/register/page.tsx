// app/auth/register/page.tsx
"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Registration is disabled - redirect to login
export default function RegisterPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.push("/auth/login");
  }, [router]);

  return null;
}
