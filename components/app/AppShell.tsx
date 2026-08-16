"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AppSidebar } from "./AppSidebar";
import { BottomNav } from "./BottomNav";
import { TopBar } from "./TopBar";
import type { Role } from "./nav";

export interface Session {
  user: { id: string; name: string; email: string; isSuperAdmin: boolean };
  role: Role;
  org: { id: string; name: string; slug: string; logo: string | null; timezone: string } | null;
  employee: {
    id: string;
    employeeCode: string;
    displayName: string;
    photo: string | null;
    designation: string | null;
    department: string | null;
  } | null;
  badges: { announcements: number; approvals: number };
}

const SessionContext = createContext<Session | null>(null);

/** Current session. Only valid inside AppShell. */
export function useSession(): Session {
  const session = useContext(SessionContext);
  if (!session) {
    throw new Error("useSession must be used within AppShell");
  }
  return session;
}

/**
 * Skeleton rather than a spinner: it holds the layout the content will occupy,
 * so the page does not jump when data lands.
 */
function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex h-16 items-center gap-3 border-b bg-surface px-4 sm:px-6">
        <div className="h-9 w-9 animate-pulse rounded-lg bg-muted" />
        <div className="space-y-1.5">
          <div className="h-3 w-32 animate-pulse rounded bg-muted" />
          <div className="h-2 w-16 animate-pulse rounded bg-muted" />
        </div>
      </div>

      <div className="flex flex-1">
        <div className="hidden w-60 shrink-0 border-r bg-surface p-4 lg:block">
          <div className="space-y-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        </div>

        <main className="flex-1 space-y-4 p-4 sm:p-6">
          <div className="h-7 w-48 animate-pulse rounded bg-muted" />
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/auth/login");
      return;
    }

    let cancelled = false;

    fetch("/api/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(async (res) => {
        const body = await res.json();
        if (!res.ok) throw new Error(body?.error ?? "Session expired");
        return body as Session;
      })
      .then((data) => {
        if (!cancelled) setSession(data);
      })
      .catch((err) => {
        if (cancelled) return;
        localStorage.removeItem("token");
        toast.error(err.message || "Please sign in again");
        router.replace("/auth/login");
      });

    return () => {
      cancelled = true;
    };
  }, [router]);

  if (!session) return <ShellSkeleton />;

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
          <AppSidebar role={role} badges={session.badges} />

          {/* Bottom padding clears the mobile tab bar. */}
          <main className="min-w-0 flex-1 px-4 pb-24 pt-6 sm:px-6 lg:pb-10">
            <div className="mx-auto max-w-6xl space-y-6">{children}</div>
          </main>
        </div>

        <BottomNav role={role} badges={session.badges} />
      </div>
    </SessionContext.Provider>
  );
}
