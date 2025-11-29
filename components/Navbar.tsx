"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import ThemeToggle from "@/components/ThemeToggle";
import ThemeColorPicker from "@/components/ThemeColorPicker";
import { Menu, LogOut, User, Bell } from "lucide-react";
import { toast } from "sonner";

type UserType = { id: string; name: string; email: string; role: string };

interface NavbarProps {
  user: UserType | null;
  onMenuClick: () => void;
  sidebarOpen: boolean;
}

export default function Navbar({ user, onMenuClick, sidebarOpen }: NavbarProps) {
  const router = useRouter();

  async function logout() {
    const token = localStorage.getItem("token");
    if (token) {
      try {
        await fetch("/api/auth/logout", { 
          method: "POST", 
          headers: { Authorization: `Bearer ${token}` } 
        });
      } catch (e) {
        // Ignore errors on logout
      }
    }
    localStorage.removeItem("token");
    toast.success("Logged out");
    router.push("/auth/login");
  }

  return (
    <nav className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-4 gap-4">
        {/* Mobile menu button */}
        <Button
          variant="ghost"
          size="icon"
          onClick={onMenuClick}
          className="lg:hidden"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </Button>

        {/* Logo/Brand */}
        <div className="flex items-center gap-2">
          <h1 className="text-xl font-bold">HRMS</h1>
        </div>

        {/* Spacer */}
        <div className="flex-1" />

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notifications (placeholder) */}
          <Button variant="ghost" size="icon" className="relative">
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 h-2 w-2 bg-red-500 rounded-full" />
          </Button>

          {/* Theme Color Picker */}
          <ThemeColorPicker />

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User info and logout */}
          {user && (
            <>
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted">
                <User className="h-4 w-4" />
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.name}</span>
                  <span className="text-xs text-muted-foreground">{user.role}</span>
                </div>
              </div>
              <Button variant="ghost" size="icon" onClick={logout} title="Logout">
                <LogOut className="h-5 w-5" />
              </Button>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}

