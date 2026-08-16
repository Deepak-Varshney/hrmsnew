"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { BOTTOM_NAV_BY_ROLE, isActive, type Role } from "./nav";

interface BottomNavProps {
  role: Role;
  badges?: Partial<Record<"announcements" | "approvals", number>>;
}

/**
 * Mobile navigation. HR software is used standing in a doorway at 9:02am, so
 * the phone layout is the primary one and the tab bar sits within thumb reach.
 */
export function BottomNav({ role, badges = {} }: BottomNavProps) {
  const pathname = usePathname() ?? "";
  const items = BOTTOM_NAV_BY_ROLE[role] ?? BOTTOM_NAV_BY_ROLE.EMPLOYEE;

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-surface/95 backdrop-blur lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="flex items-stretch">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const Icon = item.icon;
          const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

          return (
            <li key={item.href} className="flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex flex-col items-center gap-1 px-1 py-2.5 text-[11px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className="h-5 w-5" aria-hidden />
                  {badge ? (
                    <span
                      className="absolute -right-1.5 -top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-surface"
                      aria-label={`${badge} unread`}
                    />
                  ) : null}
                </span>
                <span className="truncate">{item.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
