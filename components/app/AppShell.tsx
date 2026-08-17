"use client";

import { createContext, useContext, type ReactNode } from "react";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import type { Role } from "./nav";

export interface ShellSession {
  user: { id: string; name: string; email: string; isSuperAdmin: boolean };
  role: Role;
  orgId: string | null;
  org: { id: string; name: string; slug: string; logo: string | null } | null;
  employeeId: string | null;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
    photo: string | null;
    designation: string | null;
    department: string | null;
  } | null;
  /** Super admin only: acting inside a single org rather than platform-wide. */
  actingAsOrg?: boolean;
  /** Super admin only: every org, for the switcher in the top bar. */
  orgs?: Array<{ id: string; name: string; slug: string }>;
}

export interface ShellBadges {
  announcements?: number;
  approvals?: number;
}

const SessionContext = createContext<ShellSession | null>(null);

/** Current session. Only valid inside AppShell. */
export function useSession(): ShellSession {
  const session = useContext(SessionContext);
  if (!session) throw new Error("useSession must be used within AppShell");
  return session;
}

/**
 * Layout chrome only.
 *
 * The session arrives from the server component that rendered this, so there
 * is no client-side auth fetch. That removes the failure mode where a
 * transient error was indistinguishable from an expired session and signed
 * the user out.
 */
export function AppShell({
  session,
  badges = {},
  children,
}: {
  session: ShellSession;
  badges?: ShellBadges;
  children: ReactNode;
}) {
  const role = session.role ?? "EMPLOYEE";
  const acting = Boolean(session.actingAsOrg);

  return (
    <SessionContext.Provider value={session}>
      {/*
        The shell is a fixed-height column and only <main> scrolls, so the
        top bar and sidebar stay put. h-dvh rather than h-screen: on mobile,
        h-screen ignores the browser's collapsing address bar and leaves the
        bottom of the page unreachable.
      */}
      <div className="flex h-dvh flex-col overflow-hidden">
        <TopBar
          orgName={session.org?.name ?? "Platform"}
          role={role}
          userName={session.user.name}
          orgs={session.user.isSuperAdmin ? (session.orgs ?? []) : undefined}
          actingSlug={acting ? (session.org?.slug ?? null) : null}
        />

        {/* min-h-0 lets this row shrink below its content, which is what
            allows the child to scroll instead of pushing the page taller. */}
        <div className="flex min-h-0 flex-1">
          <AppSidebar role={role} badges={badges} actingAsOrg={acting} />

          {/* Bottom padding clears the mobile tab bar. */}
          <main className="min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            <div className="mx-auto max-w-6xl space-y-6">{children}</div>
          </main>
        </div>

        <BottomNav role={role} badges={badges} />
      </div>
    </SessionContext.Provider>
  );
}
