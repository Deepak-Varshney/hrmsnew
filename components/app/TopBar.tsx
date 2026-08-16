"use client";

import { useRouter } from "next/navigation";
import { useTheme } from "next-themes";
import { useState } from "react";
import { Clock, LogOut, Moon, Sun, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABEL, type Role } from "./nav";

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
}

export function TopBar({ orgName, role, userName }: TopBarProps) {
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
    <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center justify-between gap-3 border-b bg-surface/95 px-4 backdrop-blur sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
          <Clock className="h-4.5 w-4.5 text-primary-foreground" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">{orgName}</p>
          <p className="eyebrow mt-0.5">{ROLE_LABEL[role]}</p>
        </div>
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
              menuOpen && "rotate-180"
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
                onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
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
