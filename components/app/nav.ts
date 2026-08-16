// components/app/nav.ts
//
// Navigation is grouped by what the person is trying to do, not by which
// module the engineer built. "TODAY" is the things you act on this morning;
// "PEOPLE" is the roster you manage; "ACCOUNT" is you. A flat list of twelve
// links makes the reader do that sorting themselves, every time.

import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Clock3,
  CalendarDays,
  Megaphone,
  Users,
  Wallet,
  UserRound,
  Building2,
  ScrollText,
  Trash2,
  Settings,
  ShieldCheck,
} from "lucide-react";

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "EMPLOYEE";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Key the shell resolves to a count, e.g. unread announcements. */
  badgeKey?: "announcements" | "approvals";
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

const DASHBOARD: NavItem = {
  href: "/dashboard",
  label: "Dashboard",
  icon: LayoutDashboard,
};
const ATTENDANCE: NavItem = { href: "/attendance", label: "Attendance", icon: Clock3 };
const LEAVES: NavItem = { href: "/leave", label: "Leaves", icon: CalendarDays };
const ANNOUNCEMENTS: NavItem = {
  href: "/announcements",
  label: "Announcements",
  icon: Megaphone,
  badgeKey: "announcements",
};
const PROFILE: NavItem = { href: "/me", label: "My profile", icon: UserRound };

const TODAY = (): NavGroup => ({
  label: "Today",
  items: [DASHBOARD, ATTENDANCE, LEAVES, ANNOUNCEMENTS],
});

export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  EMPLOYEE: [TODAY(), { label: "Account", items: [PROFILE] }],

  MANAGER: [
    TODAY(),
    {
      label: "People",
      items: [{ href: "/employees", label: "Employees", icon: Users }],
    },
    { label: "Account", items: [PROFILE] },
  ],

  ADMIN: [
    TODAY(),
    {
      label: "People",
      items: [
        { href: "/employees", label: "Employees", icon: Users },
        { href: "/payroll", label: "Payroll", icon: Wallet },
      ],
    },
    {
      label: "Organisation",
      items: [
        { href: "/settings", label: "Settings", icon: Settings },
        { href: "/activity", label: "Activity log", icon: ScrollText },
      ],
    },
    { label: "Account", items: [PROFILE] },
  ],

  SUPER_ADMIN: [
    {
      label: "Platform",
      items: [
        { href: "/admin", label: "Overview", icon: LayoutDashboard },
        { href: "/admin/orgs", label: "Organisations", icon: Building2 },
        { href: "/admin/users", label: "Users", icon: Users },
      ],
    },
    {
      label: "Oversight",
      items: [
        { href: "/admin/activity", label: "Activity log", icon: ScrollText },
        { href: "/admin/activity/admins", label: "Admin actions", icon: ShieldCheck },
        { href: "/admin/recycle-bin", label: "Recycle bin", icon: Trash2 },
      ],
    },
    { label: "Account", items: [PROFILE] },
  ],
};

/**
 * Mobile tab bar. Capped at five — a sixth tab makes every tap target too
 * small to hit reliably one-handed.
 */
export const BOTTOM_NAV_BY_ROLE: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { ...DASHBOARD, label: "Home" },
    { ...ATTENDANCE, label: "Time" },
    LEAVES,
    { ...ANNOUNCEMENTS, label: "News" },
    PROFILE,
  ],
  MANAGER: [
    { ...DASHBOARD, label: "Home" },
    { ...ATTENDANCE, label: "Time" },
    LEAVES,
    { ...ANNOUNCEMENTS, label: "News" },
    { href: "/employees", label: "Team", icon: Users },
  ],
  ADMIN: [
    { ...DASHBOARD, label: "Home" },
    { ...ATTENDANCE, label: "Time" },
    LEAVES,
    { href: "/employees", label: "People", icon: Users },
    { href: "/payroll", label: "Payroll", icon: Wallet },
  ],
  SUPER_ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/orgs", label: "Orgs", icon: Building2 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/activity", label: "Activity", icon: ScrollText },
    PROFILE,
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MANAGER: "Lead",
  EMPLOYEE: "Employee",
};

/** Longest match wins, so /employees/123 keeps "Employees" active. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
