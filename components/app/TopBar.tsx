"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Clock, LogOut, Moon, Sun, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "./nav";
import { OrgSwitcher, type SwitchableOrg } from "./OrgSwitcher";

export function initialsOf(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

interface TopBarProps {
  orgName: string;
  role: Role;
  userName: string;
  /** Present for a super admin: every org they can drop into. */
  orgs?: SwitchableOrg[];
  /** Slug of the org being acted in, or null at platform level. */
  actingSlug?: string | null;
}

export function TopBar({
  orgName,
  role,
  userName,
  orgs,
  actingSlug = null,
}: TopBarProps) {
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const [menuOpen, setMenuOpen] = useState(false);

  async function signOut() {
    // The cookie is httpOnly, so only the server can clear it. This also
    // deactivates the Session record, revoking the token everywhere.
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => {});
    localStorage.removeItem("token");
    router.replace("/auth/login");
    router.refresh();
  }

  return (
    // Sits outside the scroll container now, so it needs shrink-0 rather
    // than sticky positioning.
    <header className="z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
            actingSlug ? "bg-warning" : "bg-primary",
          )}
        >
          <Clock
            className={cn(
              "h-4.5 w-4.5",
              actingSlug ? "text-background" : "text-primary-foreground",
            )}
            aria-hidden
          />
        </div>

        {/* A super admin gets a picker here instead of a label: the org they
            are looking at is the single most important thing on the screen,
            and switching it is one click from anywhere in the product. */}
        {orgs ? (
          <OrgSwitcher orgs={orgs} currentSlug={actingSlug} label={orgName} />
        ) : (
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold leading-tight">
              {orgName}
            </p>
            <p className="eyebrow mt-0.5">{ROLE_LABEL[role]}</p>
          </div>
        )}

        {actingSlug ? (
          <span className="hidden shrink-0 rounded-full bg-warning/15 px-2.5 py-1 text-xs font-medium text-warning sm:inline">
            Acting as admin
          </span>
        ) : null}
      </div>

      <div className="relative">
        <button
          type="button"
          onClick={() => setMenuOpen((open) => !open)}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-muted"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-semibold">
            {initialsOf(userName)}
          </span>
          <span className="hidden max-w-[10rem] truncate text-sm font-medium sm:block">
            {userName}
          </span>
          <ChevronDown
            className={cn(
              "hidden h-4 w-4 text-muted-foreground transition-transform sm:block",
              menuOpen && "rotate-180",
            )}
            aria-hidden
          />
        </button>

        {menuOpen ? (
          <>
            <div
              className="fixed inset-0 z-10"
              onClick={() => setMenuOpen(false)}
              aria-hidden
            />
            <div
              role="menu"
              className="absolute right-0 z-20 mt-2 w-52 overflow-hidden rounded-lg border bg-popover py-1 shadow-lg"
            >
              <div className="border-b px-3 py-2">
                <p className="truncate text-sm font-medium">{userName}</p>
                <p className="eyebrow mt-0.5">{ROLE_LABEL[role]}</p>
              </div>

              <button
                type="button"
                role="menuitem"
                onClick={() =>
                  setTheme(resolvedTheme === "dark" ? "light" : "dark")
                }
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted"
              >
                {resolvedTheme === "dark" ? (
                  <Sun className="h-4 w-4" aria-hidden />
                ) : (
                  <Moon className="h-4 w-4" aria-hidden />
                )}
                {resolvedTheme === "dark" ? "Light theme" : "Dark theme"}
              </button>

              <button
                type="button"
                role="menuitem"
                onClick={signOut}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-sm text-danger transition-colors hover:bg-danger/10"
              >
                <LogOut className="h-4 w-4" aria-hidden />
                Sign out
              </button>
            </div>
          </>
        ) : null}
      </div>
    </header>
  );
}
