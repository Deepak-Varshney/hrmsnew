"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, X, Inbox, ArrowRight } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, type PillTone } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";

const STATUS_TONE: Record<string, PillTone> = {
  pending: "warning",
  approved: "success",
  rejected: "danger",
  cancelled: "neutral",
};

const FILTERS = ["pending", "approved", "rejected", "cancelled"];

interface ChangeField {
  path: string;
  label: string;
  oldValue?: any;
  newValue?: any;
  sensitive?: boolean;
}

interface RequestRow {
  _id: string;
  requestedByName: string;
  employeeId?: { displayName?: string; employeeCode?: string } | null;
  fields: ChangeField[];
  note?: string;
  status: string;
  createdAt: string;
  reviewedByName?: string | null;
  reviewNote?: string | null;
}

function show(value: any): string {
  if (value == null || value === "") return "—";
  if (typeof value === "object") {
    return Object.values(value).filter(Boolean).join(", ") || "—";
  }
  return String(value);
}

export function RequestsClient({
  requests,
  status,
}: {
  requests: RequestRow[];
  status: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function review(id: string, decision: "approved" | "rejected") {
    const note =
      decision === "rejected"
        ? prompt("Why is this being rejected?")?.trim()
        : undefined;
    if (decision === "rejected" && !note) return;

    setBusy(id);
    try {
      const res = await fetch(`/api/change-requests/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision, note }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      toast.success(body.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader
        title="Change requests"
        description="Edits employees have asked for. Approving one applies it to their record."
        actions={
          <select
            value={status}
            onChange={(e) =>
              startTransition(() => router.push(`/requests?status=${e.target.value}`))
            }
            aria-label="Filter by status"
            className="h-9 rounded-md border bg-surface px-3 text-sm capitalize"
          >
            {FILTERS.map((f) => (
              <option key={f} value={f} className="capitalize">
                {f}
              </option>
            ))}
          </select>
        }
      />

      {requests.length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={`Nothing ${status}`}
          description="When someone updates their phone number, address or bank details, the request lands here for you to approve before it reaches their record."
        />
      ) : (
        <ul className="space-y-3">
          {requests.map((r) => (
            <li key={r._id} className="rounded-lg border bg-surface p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-sm font-medium">
                    {r.employeeId?.displayName ?? r.requestedByName}
                    {r.employeeId?.employeeCode ? (
                      <span className="tabular ml-2 text-xs text-subtle-foreground">
                        {r.employeeId.employeeCode}
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-xs text-subtle-foreground">
                    Asked on {formatDate(r.createdAt)}
                  </p>
                </div>

                <StatusPill tone={STATUS_TONE[r.status] ?? "neutral"}>
                  {r.status}
                </StatusPill>
              </div>

              <ul className="mt-3 space-y-1.5 border-t pt-3">
                {r.fields.map((f) => (
                  <li key={f.path} className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="w-40 shrink-0 text-muted-foreground">{f.label}</span>
                    <span className="text-subtle-foreground line-through">
                      {show(f.oldValue)}
                    </span>
                    <ArrowRight className="h-3 w-3 text-subtle-foreground" aria-hidden />
                    <span className="font-medium">{show(f.newValue)}</span>
                  </li>
                ))}
              </ul>

              {r.note ? (
                <p className="mt-3 text-sm text-muted-foreground">“{r.note}”</p>
              ) : null}

              {r.status === "pending" ? (
                <div className="mt-4 flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => review(r._id, "approved")}
                    disabled={busy === r._id}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => review(r._id, "rejected")}
                    disabled={busy === r._id}
                  >
                    <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                    Reject
                  </Button>
                </div>
              ) : r.reviewedByName ? (
                <p className="mt-3 border-t pt-3 text-xs text-subtle-foreground">
                  {r.status} by {r.reviewedByName}
                  {r.reviewNote ? ` — ${r.reviewNote}` : ""}
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
