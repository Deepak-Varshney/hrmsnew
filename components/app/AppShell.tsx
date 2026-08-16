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

  return (
    <SessionContext.Provider value={session}>
      <div className="flex min-h-screen flex-col">
        <TopBar
          orgName={session.org?.name ?? "Platform"}
          role={role}
          userName={session.user.name}
        />

        <div className="flex flex-1">
          <AppSidebar role={role} badges={badges} />

          {/* Bottom padding clears the mobile tab bar. */}
          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            <div className="mx-auto max-w-6xl space-y-6">{children}</div>
          </main>
        </div>

        <BottomNav role={role} badges={badges} />
      </div>
    </SessionContext.Provider>
  );
}
