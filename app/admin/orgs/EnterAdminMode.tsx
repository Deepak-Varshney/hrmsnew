"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Drops the super admin into an org as its admin. Same product, same pages,
 * scoped to that tenant — see lib/actingOrg.ts.
 */
export function EnterAdminMode({ slug, name }: { slug: string; name: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function enter() {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/act-as", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Could not switch");

      toast.success(result.message);
      router.replace("/dashboard");
      router.refresh();
    } catch (err: any) {
      toast.error(err.message);
      setBusy(false);
    }
  }

  return (
    <Button
      size="sm"
      variant="outline"
      onClick={enter}
      disabled={busy}
      aria-label={`Enter admin mode for ${name}`}
    >
      <LogIn className="mr-1.5 h-3.5 w-3.5" aria-hidden />
      Admin mode
    </Button>
  );
}
