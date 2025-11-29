// app/auth/login/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: any) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const j = await res.json();
      setLoading(false);
      if (!res.ok) {
        toast.error(j.error || "Login failed");
        return;
      }
      localStorage.setItem("token", j.token);
      toast.success(`Welcome back ${j.user.name}`);
      router.push("/dashboard");
    } catch (err: any) {
      setLoading(false);
      toast.error("Network error");
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Sign in</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Email</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            <div>
              <Label>Password</Label>
              <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
            </div>

            <div className="flex justify-between items-center">
              <div className="text-sm">
                <a href="/auth/register" className="text-blue-600 underline">Create account</a>
              </div>
              <Button type="submit" disabled={loading}>{loading ? "Signing in..." : "Sign in"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
