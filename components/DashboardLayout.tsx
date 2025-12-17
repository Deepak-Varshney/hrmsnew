"use client";

import { useState, useEffect, ReactNode } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";
import { toast } from "sonner";

type UserType = { id: string; name: string; email: string; role: string };

interface DashboardLayoutProps {
  children: ReactNode;
}

export default function DashboardLayout({ children }: DashboardLayoutProps) {
  const [user, setUser] = useState<UserType | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }

    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((j) => {
        if (j.error) {
          localStorage.removeItem("token");
          toast.error("Session expired");
          router.push("/auth/login");
          return;
        }
        setUser(j.user);
        setLoading(false);
      })
      .catch(() => {
        localStorage.removeItem("token");
        toast.error("Session error");
        router.push("/auth/login");
      });
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar 
        user={user} 
        onMenuClick={() => setSidebarOpen(!sidebarOpen)} 
        sidebarOpen={sidebarOpen}
      />
      <Sidebar 
        user={user} 
        open={sidebarOpen} 
        onClose={() => setSidebarOpen(false)} 
      />
      <main className="lg:ml-64 transition-all duration-300">
        <div className="p-6">{children}</div>
      </main>
    </div>
  );
}

