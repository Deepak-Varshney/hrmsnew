"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { RotateCcw, Trash2, Trash } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusPill } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

interface Item {
  id: string;
  type: string;
  label: string;
  deletedAt: string;
  deletedByRole: string | null;
  reason: string | null;
}

export function RecycleBinClient({ items }: { items: Item[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function call(body: Record<string, any>, id: string) {
    setBusy(id);
    try {
      const res = await fetch("/api/admin/recycle-bin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "That did not work");
      toast.success(result.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  function restore(item: Item) {
    call({ action: "restore", entityType: item.type, id: item.id }, item.id);
  }

  function purge(item: Item) {
    // Typing the name is the guard against a misplaced click. There is no
    // undo, so the confirmation asks for something you cannot do by reflex.
    const typed = prompt(
      `This permanently deletes "${item.label}". It cannot be undone.\n\nType the name exactly to confirm:`,
    );
    if (!typed) return;

    call(
      {
        action: "purge",
        entityType: item.type,
        id: item.id,
        confirmLabel: typed,
      },
      item.id,
    );
  }

  return (
    <>
      <PageHeader
        title="Recycle bin"
        description="Everything soft-deleted, across every organisation. Restoring puts a record back; purging destroys it."
      />

      {items.length === 0 ? (
        <EmptyState
          icon={Trash2}
          title="Nothing deleted"
          description="Deleted employees, users and organisations collect here instead of disappearing. Only you can restore or permanently remove them."
        />
      ) : (
        <ul className="divide-y overflow-hidden rounded-lg border bg-surface">
          {items.map((item) => (
            <li
              key={`${item.type}-${item.id}`}
              className="flex flex-wrap items-center gap-3 p-4"
            >
              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm font-medium">
                  <StatusPill tone="neutral" dot={false}>
                    {item.type}
                  </StatusPill>
                  {item.label}
                </p>
                <p className="mt-0.5 text-xs text-subtle-foreground">
                  Deleted {formatDate(item.deletedAt)}
                  {item.deletedByRole ? ` by ${item.deletedByRole}` : ""}
                  {item.reason ? ` — ${item.reason}` : ""}
                </p>
              </div>

              <div className="flex shrink-0 gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => restore(item)}
                  disabled={busy === item.id}
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Restore
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => purge(item)}
                  disabled={busy === item.id}
                  className="text-danger hover:bg-danger/10"
                >
                  <Trash className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                  Delete forever
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
