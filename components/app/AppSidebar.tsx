"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV_BY_ROLE, isActive, type Role } from "./nav";

interface AppSidebarProps {
  role: Role;
  badges?: Partial<Record<"announcements" | "approvals", number>>;
}

export function AppSidebar({ role, badges = {} }: AppSidebarProps) {
  const pathname = usePathname() ?? "";
  const groups = NAV_BY_ROLE[role] ?? NAV_BY_ROLE.EMPLOYEE;

  return (
    <nav
      aria-label="Main"
      className="hidden w-60 shrink-0 flex-col gap-6 overflow-y-auto border-r bg-surface px-3 py-6 lg:flex"
    >
      {groups.map((group) => (
        <div key={group.label}>
          <p className="eyebrow px-3 pb-2">{group.label}</p>

          <ul className="space-y-0.5">
            {group.items.map((item) => {
              const active = isActive(pathname, item.href);
              const Icon = item.icon;
              const badge = item.badgeKey ? badges[item.badgeKey] : undefined;

              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "relative flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary/10 font-medium text-primary"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    {active ? (
                      <span
                        className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-primary"
                        aria-hidden
                      />
                    ) : null}

                    <Icon className="h-4 w-4 shrink-0" aria-hidden />
                    <span className="truncate">{item.label}</span>

                    {badge ? (
                      <span className="tabular ml-auto rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold leading-none text-primary-foreground">
                        {badge}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
