"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CalendarPlus, CalendarX2, Check, X, Inbox } from "lucide-react";

import { PageHeader } from "@/components/ui/page-header";
import { StatusPill, LEAVE_STATUS_TONE } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatDate } from "@/lib/format";

interface Balance {
  code: string;
  name: string;
  paid: boolean;
  total: number;
  used: number;
  pending: number;
  available: number;
  uncapped: boolean;
}

interface LeaveRow {
  _id: string;
  leaveType: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: string;
  approverRemarks?: string;
  employeeName?: string;
  employeeCode?: string;
  days?: number;
}

export function LeaveClient({
  balances,
  mine,
  team,
  seesTeam,
  year,
}: {
  balances: Balance[];
  mine: LeaveRow[];
  team: LeaveRow[];
  seesTeam: boolean;
  year: number;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [tab, setTab] = useState<"mine" | "team">("mine");
  const [showForm, setShowForm] = useState(false);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    leaveType: "CL",
    fromDate: "",
    toDate: "",
    reason: "",
  });

  const pendingCount = team.filter((r) => r.status === "Pending").length;

  async function apply() {
    setBusy(true);
    try {
      const res = await fetch("/api/leave", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not apply");

      toast.success(body.message);
      setShowForm(false);
      setForm({ leaveType: "CL", fromDate: "", toDate: "", reason: "" });
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function review(leaveId: string, decision: "Approved" | "Rejected") {
    const remarks =
      decision === "Rejected"
        ? prompt("Why is this being rejected?")?.trim()
        : undefined;
    if (decision === "Rejected" && !remarks) return;

    setBusy(true);
    try {
      const res = await fetch("/api/leave/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ leaveId, decision, remarks }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not save");
      toast.success(body.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(leaveId: string) {
    if (!confirm("Withdraw this request?")) return;
    try {
      const res = await fetch(`/api/leave?id=${leaveId}`, { method: "DELETE" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not withdraw");
      toast.success(body.message);
      startTransition(() => router.refresh());
    } catch (err: any) {
      toast.error(err.message);
    }
  }

  return (
    <>
      <PageHeader
        title="Leaves"
        description={
          seesTeam
            ? `Your balance for ${year}, plus the requests you can decide on.`
            : `Your balance for ${year} and everything you have filed.`
        }
        actions={
          <Button onClick={() => setShowForm((s) => !s)}>
            <CalendarPlus className="mr-2 h-4 w-4" aria-hidden />
            Request leave
          </Button>
        }
      />

      {/* Balances */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {balances.map((b) => (
          <div key={b.code} className="rounded-lg border bg-surface p-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-medium">{b.name}</span>
              <StatusPill tone={b.paid ? "success" : "neutral"} dot={false}>
                {b.paid ? "Paid" : "Unpaid"}
              </StatusPill>
            </div>

            {b.uncapped ? (
              <>
                <p className="mt-3 text-2xl font-semibold">No cap</p>
                <p className="mt-1 text-xs leading-relaxed text-subtle-foreground">
                  No annual quota — every approved day is deducted as loss of pay.
                </p>
              </>
            ) : (
              <>
                <p className="tabular mt-3 text-2xl font-semibold">
                  {b.available}
                  <span className="text-base font-normal text-subtle-foreground">
                    {" "}
                    / {b.total} days
                  </span>
                </p>
                <p className="mt-1 text-xs text-subtle-foreground">
                  {b.used} taken · {b.pending} pending
                </p>
              </>
            )}
          </div>
        ))}
      </div>

      {/* Apply form */}
      {showForm ? (
        <section className="rounded-lg border bg-surface p-4 sm:p-5">
          <h2 className="text-base font-semibold">Request leave</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            The day count skips weekends for you.
          </p>

          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="type">Type</Label>
              <select
                id="type"
                value={form.leaveType}
                onChange={(e) => setForm({ ...form, leaveType: e.target.value })}
                className="mt-1 h-9 w-full rounded-md border bg-background px-3 text-sm"
              >
                {balances.map((b) => (
                  <option key={b.code} value={b.code}>
                    {b.name}
                    {b.uncapped ? "" : ` — ${b.available} left`}
                  </option>
                ))}
              </select>
            </div>
            <div />
            <div>
              <Label htmlFor="from">From</Label>
              <Input
                id="from"
                type="date"
                value={form.fromDate}
                onChange={(e) => setForm({ ...form, fromDate: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="to">To</Label>
              <Input
                id="to"
                type="date"
                value={form.toDate}
                min={form.fromDate}
                onChange={(e) => setForm({ ...form, toDate: e.target.value })}
              />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="reason">Reason</Label>
              <Input
                id="reason"
                value={form.reason}
                placeholder="A line is enough"
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
              />
            </div>
          </div>

          <div className="mt-4 flex gap-2">
            <Button onClick={apply} disabled={busy}>
              {busy ? "Sending…" : "Submit request"}
            </Button>
            <Button variant="ghost" onClick={() => setShowForm(false)}>
              Cancel
            </Button>
          </div>
        </section>
      ) : null}

      {/* Tabs */}
      {seesTeam ? (
        <div className="flex gap-1 border-b">
          <button
            onClick={() => setTab("mine")}
            className={`border-b-2 px-3 py-2.5 text-sm transition-colors ${
              tab === "mine"
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            My requests
          </button>
          <button
            onClick={() => setTab("team")}
            className={`flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm transition-colors ${
              tab === "team"
                ? "border-primary font-medium text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            Team requests
            {pendingCount > 0 ? (
              <span className="tabular rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">
                {pendingCount}
              </span>
            ) : null}
          </button>
        </div>
      ) : null}

      {/* My requests */}
      {tab === "mine" ? (
        <section className="overflow-hidden rounded-lg border bg-surface">
          {mine.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={CalendarX2}
              title={`No requests in ${year}`}
              description="Use Request leave to file one — the day count skips weekends for you."
            />
          ) : (
            <ul className="divide-y">
              {mine.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">
                      {r.leaveType} · {formatDate(r.fromDate)}
                      {r.fromDate !== r.toDate ? ` → ${formatDate(r.toDate)}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle-foreground">{r.reason}</p>
                    {r.approverRemarks ? (
                      <p className="mt-1 text-xs text-danger">{r.approverRemarks}</p>
                    ) : null}
                  </div>

                  <StatusPill tone={LEAVE_STATUS_TONE[r.status] ?? "neutral"}>
                    {r.status}
                  </StatusPill>

                  {r.status === "Pending" ? (
                    <Button variant="ghost" size="sm" onClick={() => withdraw(r._id)}>
                      Withdraw
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      {/* Team requests */}
      {tab === "team" && seesTeam ? (
        <section className="overflow-hidden rounded-lg border bg-surface">
          {team.length === 0 ? (
            <EmptyState
              className="border-0"
              icon={Inbox}
              title="Nothing to decide"
              description="Leave requests from the people reporting to you land here. There is nothing waiting right now."
            />
          ) : (
            <ul className="divide-y">
              {team.map((r) => (
                <li key={r._id} className="flex flex-wrap items-center gap-3 p-4">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{r.employeeName}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {r.leaveType} · {formatDate(r.fromDate)}
                      {r.fromDate !== r.toDate ? ` → ${formatDate(r.toDate)}` : ""}
                      {r.days ? ` · ${r.days} day${r.days === 1 ? "" : "s"}` : ""}
                    </p>
                    <p className="mt-0.5 text-xs text-subtle-foreground">{r.reason}</p>
                  </div>

                  {r.status === "Pending" ? (
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => review(r._id, "Approved")}
                        disabled={busy}
                      >
                        <Check className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Approve
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => review(r._id, "Rejected")}
                        disabled={busy}
                      >
                        <X className="mr-1.5 h-3.5 w-3.5" aria-hidden />
                        Reject
                      </Button>
                    </div>
                  ) : (
                    <StatusPill tone={LEAVE_STATUS_TONE[r.status] ?? "neutral"}>
                      {r.status}
                    </StatusPill>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </>
  );
}
