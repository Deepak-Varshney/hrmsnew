"use client";

// The super admin's org picker.
//
// Choosing an org enters "admin mode": the rest of the product then behaves
// exactly as it does for that org's own admin — same nav, same pages, same
// data — while platform powers stay available underneath.

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Building2, Check, ChevronDown, Globe, Search } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SwitchableOrg {
  id: string;
  name: string;
  slug: string;
}

export function OrgSwitcher({
  orgs,
  currentSlug,
  label,
}: {
  orgs: SwitchableOrg[];
  currentSlug: string | null;
  label: string;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);
  const [, startTransition] = useTransition();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orgs;
    return orgs.filter(
      (o) =>
        o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q),
    );
  }, [orgs, query]);

  async function choose(slug: string | null) {
    if (slug === currentSlug) {
      setOpen(false);
      return;
    }

    setBusy(true);
    try {
      const res = await fetch("/api/admin/act-as", {
        method: slug ? "POST" : "DELETE",
        headers: { "Content-Type": "application/json" },
        body: slug ? JSON.stringify({ slug }) : undefined,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not switch");

      toast.success(result.message);
      setOpen(false);

      // Land somewhere that exists in the mode being entered: the org
      // dashboard when acting, the platform console when stepping back.
      router.replace(slug ? "/dashboard" : "/admin");
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative min-w-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="menu"
        disabled={busy}
        className="flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold leading-tight">
            {label}
          </span>
          <span className="eyebrow mt-0.5 block">
            {currentSlug ? "Admin mode" : "Super admin"}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-180",
          )}
          aria-hidden
        />
      </button>

      {open ? (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div
            role="menu"
            className="absolute left-0 z-20 mt-2 w-72 overflow-hidden rounded-lg border bg-popover shadow-lg"
          >
            <div className="flex items-center gap-2 border-b px-3 py-2">
              <Search
                className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find an organisation"
                aria-label="Find an organisation"
                className="w-full bg-transparent text-sm outline-none placeholder:text-subtle-foreground"
              />
            </div>

            <button
              type="button"
              role="menuitem"
              onClick={() => choose(null)}
              className="flex w-full items-center gap-2.5 border-b px-3 py-2.5 text-sm transition-colors hover:bg-muted"
            >
              <Globe
                className="h-4 w-4 shrink-0 text-muted-foreground"
                aria-hidden
              />
              <span className="flex-1 text-left">
                <span className="block font-medium">Platform console</span>
                <span className="block text-xs text-subtle-foreground">
                  Every organisation at once
                </span>
              </span>
              {currentSlug === null ? (
                <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
              ) : null}
            </button>

            <div className="max-h-72 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <p className="px-3 py-4 text-center text-sm text-muted-foreground">
                  No organisation matches.
                </p>
              ) : (
                filtered.map((org) => (
                  <button
                    key={org.id}
                    type="button"
                    role="menuitem"
                    onClick={() => choose(org.slug)}
                    className="flex w-full items-center gap-2.5 px-3 py-2 text-sm transition-colors hover:bg-muted"
                  >
                    <Building2
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 text-left">
                      <span className="block truncate font-medium">
                        {org.name}
                      </span>
                      <span className="block truncate text-xs text-subtle-foreground">
                        /{org.slug}
                      </span>
                    </span>
                    {currentSlug === org.slug ? (
                      <Check
                        className="h-4 w-4 shrink-0 text-primary"
                        aria-hidden
                      />
                    ) : null}
                  </button>
                ))
              )}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
