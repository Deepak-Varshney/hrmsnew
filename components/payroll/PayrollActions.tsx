"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Play, Check, Banknote, FileDown } from "lucide-react";
import { Button } from "@/components/ui/button";

type Action = "generate" | "approve" | "paid";

/**
 * The payroll lifecycle, as buttons.
 *
 * Only the action that is actually available next is offered — showing
 * "Approve" next to a run that has not been generated invites a click that
 * can only fail.
 */
export function PayrollActions({
  month,
  status,
}: {
  month: string;
  /** null when no run exists for this month yet. */
  status: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState<Action | "download" | null>(null);
  const [, startTransition] = useTransition();

  async function run(action: Action) {
    // Approving is what releases money. Make the person confirm the figure
    // they are signing off, not just the fact of signing off.
    if (action === "approve" && !confirm(`Approve payroll for ${month}? Once approved it cannot be regenerated — corrections have to go in a later run.`)) {
      return;
    }

    setBusy(action);
    try {
      const res = await fetch("/api/payroll/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ month, action }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "That did not work");

      toast.success(body.message);
      if (body.skipped?.length) {
        toast.warning(`Skipped: ${body.skipped.join(", ")}`);
      }
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  async function downloadBankFile() {
    setBusy("download");
    try {
      const res = await fetch(`/api/payroll/bank-advice?month=${month}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not generate the bank file");
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `bank-advice-${month}.csv`;
      link.click();
      URL.revokeObjectURL(url);

      toast.success("Bank file downloaded", {
        description: "It contains full account numbers — handle it accordingly.",
      });
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  }

  const canGenerate = status === null || status === "draft" || status === "computed";
  const canApprove = status === "computed";
  const canPay = status === "approved";
  const canDownload = status === "approved" || status === "paid";

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canGenerate ? (
        <Button
          variant={status === "computed" ? "outline" : "default"}
          onClick={() => run("generate")}
          disabled={busy !== null}
        >
          <Play className="mr-2 h-4 w-4" aria-hidden />
          {status === "computed" ? "Regenerate" : "Generate payroll"}
        </Button>
      ) : null}

      {canApprove ? (
        <Button onClick={() => run("approve")} disabled={busy !== null}>
          <Check className="mr-2 h-4 w-4" aria-hidden />
          Approve
        </Button>
      ) : null}

      {canPay ? (
        <Button onClick={() => run("paid")} disabled={busy !== null}>
          <Banknote className="mr-2 h-4 w-4" aria-hidden />
          Mark paid
        </Button>
      ) : null}

      {canDownload ? (
        <Button variant="outline" onClick={downloadBankFile} disabled={busy !== null}>
          <FileDown className="mr-2 h-4 w-4" aria-hidden />
          Bank file
        </Button>
      ) : null}
    </div>
  );
}
