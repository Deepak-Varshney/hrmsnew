// components/app/nav.ts
//
// Navigation is grouped by what the person is trying to do, not by which
// module the engineer built. "Today" is what you act on this morning;
// "People" is the roster and the money; "Account" is you.

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
  Inbox as InboxIcon,
} from "lucide-react";

export type Role = "SUPER_ADMIN" | "ADMIN" | "MANAGER" | "LEAD" | "EMPLOYEE";

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
const ATTENDANCE: NavItem = {
  href: "/attendance",
  label: "Attendance",
  icon: Clock3,
};
const LEAVES: NavItem = { href: "/leave", label: "Leaves", icon: CalendarDays };
const ANNOUNCEMENTS: NavItem = {
  href: "/announcements",
  label: "Announcements",
  icon: Megaphone,
  badgeKey: "announcements",
};
const EMPLOYEES: NavItem = {
  href: "/employees",
  label: "Employees",
  icon: Users,
};
const PAYROLL: NavItem = { href: "/payroll", label: "Payroll", icon: Wallet };
const PROFILE: NavItem = {
  href: "/profile",
  label: "My profile",
  icon: UserRound,
};

const TODAY = (): NavGroup => ({
  label: "Today",
  items: [DASHBOARD, ATTENDANCE, LEAVES, ANNOUNCEMENTS],
});

/** Everyone sees their own payslips; only leadership sees the roster. */
const withTeam: NavGroup = { label: "People", items: [EMPLOYEES, PAYROLL] };
const selfOnly: NavGroup = { label: "People", items: [PAYROLL] };
const POLICIES: NavItem = {
  href: "/policies",
  label: "Policies",
  icon: ScrollText,
};
const ACCOUNT: NavGroup = { label: "Account", items: [PROFILE, POLICIES] };

export const NAV_BY_ROLE: Record<Role, NavGroup[]> = {
  EMPLOYEE: [TODAY(), selfOnly, ACCOUNT],
  LEAD: [TODAY(), withTeam, ACCOUNT],
  MANAGER: [TODAY(), withTeam, ACCOUNT],

  ADMIN: [
    TODAY(),
    withTeam,
    {
      label: "Organisation",
      // No Settings entry yet — app/settings/page.tsx does not exist, and a
      // nav item that 404s is worse than a missing one. Add it back with the
      // page.
      items: [
        { href: "/requests", label: "Change requests", icon: InboxIcon },
        { href: "/activity", label: "Activity log", icon: ScrollText },
      ],
    },
    ACCOUNT,
  ],

  // No Account group: a super admin has no employee record, so /profile and
  // /policies — both of which need an org — have nothing to show them.
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
        {
          href: "/admin/activity?actorRole=ADMIN",
          label: "Admin actions",
          icon: ShieldCheck,
        },
        { href: "/admin/recycle-bin", label: "Recycle bin", icon: Trash2 },
      ],
    },
  ],
};

/**
 * Sidebar groups for a role.
 *
 * While a super admin is in admin mode they see the full admin nav for that
 * org, plus a way back — without it the only route out of a tenant would be
 * the org switcher, and a single exit is one bug away from feeling trapped.
 */
export function navGroupsFor(role: Role, actingAsOrg = false): NavGroup[] {
  const groups = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.EMPLOYEE;
  if (!actingAsOrg) return groups;

  return [
    ...groups,
    {
      label: "Platform",
      items: [{ href: "/admin", label: "Platform console", icon: ShieldCheck }],
    },
  ];
}

/**
 * Mobile tab bar. Capped at five — a sixth tab makes every target too small
 * to hit reliably one-handed.
 */
const TEAM_TABS: NavItem[] = [
  { ...DASHBOARD, label: "Home" },
  { ...ATTENDANCE, label: "Time" },
  LEAVES,
  { ...ANNOUNCEMENTS, label: "News" },
  { ...EMPLOYEES, label: "Team" },
];

export const BOTTOM_NAV_BY_ROLE: Record<Role, NavItem[]> = {
  EMPLOYEE: [
    { ...DASHBOARD, label: "Home" },
    { ...ATTENDANCE, label: "Time" },
    LEAVES,
    { ...ANNOUNCEMENTS, label: "News" },
    PROFILE,
  ],
  LEAD: TEAM_TABS,
  MANAGER: TEAM_TABS,
  ADMIN: [
    { ...DASHBOARD, label: "Home" },
    { ...ATTENDANCE, label: "Time" },
    LEAVES,
    { ...EMPLOYEES, label: "People" },
    PAYROLL,
  ],
  SUPER_ADMIN: [
    { href: "/admin", label: "Overview", icon: LayoutDashboard },
    { href: "/admin/orgs", label: "Orgs", icon: Building2 },
    { href: "/admin/users", label: "Users", icon: Users },
    { href: "/admin/activity", label: "Activity", icon: ScrollText },
    { href: "/admin/recycle-bin", label: "Bin", icon: Trash2 },
  ],
};

export const ROLE_LABEL: Record<Role, string> = {
  SUPER_ADMIN: "Super admin",
  ADMIN: "Admin",
  MANAGER: "Manager",
  LEAD: "Lead",
  EMPLOYEE: "Employee",
};

/** Longest match wins, so /employees/123 keeps "Employees" active. */
export function isActive(pathname: string, href: string): boolean {
  if (href === "/admin") return pathname === "/admin";
  return pathname === href || pathname.startsWith(`${href}/`);
}
