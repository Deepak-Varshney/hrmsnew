// app/auth/register/page.tsx
"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import { toast } from "sonner";

export default function RegisterPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("Employee");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function onSubmit(e: any) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password, role }),
      });
      const j = await res.json();
      setLoading(false);
      if (!res.ok) {
        toast.error(j.error || "Registration failed");
        return;
      }
      localStorage.setItem("token", j.token);
      toast.success(`Welcome ${j.user.name}`);
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
          <CardTitle>Create an account</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="space-y-4">
            <div>
              <Label>Name</Label>
              <Input required value={name} onChange={(e) => setName(e.target.value)} placeholder="John Doe" />
            </div>

            <div>
              <Label>Email</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" />
            </div>

            <div>
              <Label>Password</Label>
              <Input required type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Strong password" />
            </div>

            <div>
              <Label>Role</Label>
              <Select onValueChange={(v) => setRole(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={role} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Employee">Employee</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="HR">HR</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={loading}>{loading ? "Creating..." : "Register"}</Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
