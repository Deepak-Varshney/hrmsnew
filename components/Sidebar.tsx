"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Clock,
  Calendar,
  FileText,
  DollarSign,
  Briefcase,
  FolderOpen,
  Users,
  Settings,
  FileCheck,
  Building2,
  X,
  Bell,
} from "lucide-react";
import { Button } from "@/components/ui/button";

interface SidebarProps {
  user: { role: string } | null;
  open: boolean;
  onClose: () => void;
}

const menuItems = {
  Employee: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/attendance", label: "Attendance", icon: Clock },
    { href: "/attendance/regularisation", label: "Regularisation", icon: FileCheck },
    { href: "/leave", label: "Leave Management", icon: Calendar },
    { href: "/announcements", label: "Announcements", icon: Bell },
    { href: "/policies", label: "Policies", icon: FileText },
    { href: "/payroll", label: "Payroll", icon: DollarSign },
    { href: "/documents", label: "Documents", icon: FolderOpen },
    { href: "/assets", label: "Assets", icon: Briefcase },
  ],
  Manager: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/team", label: "Team Overview", icon: Users },
    { href: "/team/attendance", label: "Team Attendance", icon: Clock },
    { href: "/team/leave", label: "Leave Approvals", icon: Calendar },
    { href: "/team/regularisation", label: "Regularisation", icon: FileCheck },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/attendance", label: "My Attendance", icon: Clock },
    { href: "/leave", label: "My Leave", icon: Calendar },
    { href: "/announcements", label: "Announcements", icon: Bell },
    { href: "/policies", label: "Policies", icon: FileText },
  ],
  HR: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employees", label: "Employees", icon: Users },
    { href: "/attendance", label: "Attendance", icon: Clock },
    { href: "/leave", label: "Leave Management", icon: Calendar },
    { href: "/announcements", label: "Announcements", icon: Bell },
    { href: "/policies", label: "Policies", icon: FileText },
    { href: "/payroll", label: "Payroll", icon: DollarSign },
    { href: "/documents", label: "Documents", icon: FolderOpen },
    { href: "/settings", label: "Settings", icon: Settings },
  ],
  Admin: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employees", label: "Employees", icon: Users },
    { href: "/attendance", label: "Attendance", icon: Clock },
    { href: "/leave", label: "Leave Management", icon: Calendar },
    { href: "/announcements", label: "Announcements", icon: Bell },
    { href: "/policies", label: "Policies", icon: FileText },
    { href: "/reports", label: "Reports", icon: FileText },
    { href: "/payroll", label: "Payroll", icon: DollarSign },
    { href: "/documents", label: "Documents", icon: FolderOpen },
    { href: "/settings", label: "Settings", icon: Settings },
    { href: "/audit", label: "Audit Logs", icon: Building2 },
  ],
};

export default function Sidebar({ user, open, onClose }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const role = user?.role || "Employee";
  const items = menuItems[role as keyof typeof menuItems] || menuItems.Employee;

  return (
    <>
      {/* Overlay for mobile */}
      {open && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed top-16 left-0 z-50 h-[calc(100vh-4rem)] w-64 bg-background border-r transition-transform duration-300 ease-in-out lg:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Mobile close button */}
          <div className="flex items-center justify-between p-4 border-b lg:hidden">
            <h2 className="font-semibold">Menu</h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Navigation items */}
          <nav className="flex-1 overflow-y-auto p-4 space-y-1">
            {items.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => {
                    // Close sidebar on mobile when navigating
                    if (window.innerWidth < 1024) {
                      onClose();
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-primary text-primary-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t text-xs text-muted-foreground">
            <div className="font-medium">HRMS v1.0</div>
            <div className="text-xs mt-1">© 2024 All rights reserved</div>
          </div>
        </div>
      </aside>
    </>
  );
}

