"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Search, Users, UserCheck, UserMinus, LogOut, Building2 } from "lucide-react";

import { initialsOf } from "@/components/app/TopBar";
import { PageHeader } from "@/components/ui/page-header";
import { StatCard, StatGrid } from "@/components/ui/stat-card";
import { StatusPill, EMPLOYEE_STATUS_TONE } from "@/components/ui/status-pill";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { HeadcountSummary } from "@/lib/services/employeeQueries";

export interface EmployeeRow {
  _id: string;
  employeeCode: string;
  displayName: string;
  contact?: { workEmail?: string };
  employment?: { status?: string; dateOfJoining?: string };
  designationId?: { title?: string } | null;
  departmentId?: { name?: string } | null;
}

const STATUS_LABEL: Record<string, string> = {
  active: "Active",
  probation: "Probation",
  "notice-period": "Notice period",
  "on-leave": "On leave",
  exited: "Departed",
};

const STATUS_FILTERS = [
  { value: "", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "probation", label: "Probation" },
  { value: "notice-period", label: "Notice period" },
  { value: "on-leave", label: "On leave" },
  { value: "exited", label: "Departed" },
];

function formatDate(value?: string) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/** What this page shows depends on who is reading it — say so, don't imply it. */
function describeScope(role: string, orgName: string | null) {
  switch (role) {
    case "SUPER_ADMIN":
      return `Everyone on the roll at ${orgName ?? "this organisation"}.`;
    case "ADMIN":
      return "Everyone on the roll, including people who have left.";
    case "MANAGER":
      return "You and the people reporting to you.";
    default:
      return "Your own record.";
  }
}

export function EmployeesClient({
  employees,
  pagination,
  summary,
  options,
  filters,
  role,
  orgName,
}: {
  employees: EmployeeRow[];
  pagination: { page: number; limit: number; total: number; pages: number };
  summary: HeadcountSummary;
  options: { departments: { id: string; name: string }[] };
  filters: { search: string; status: string; departmentId: string };
  role: string;
  orgName: string | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const [search, setSearch] = useState(filters.search);
  const [status, setStatus] = useState(filters.status);
  const [departmentId, setDepartmentId] = useState(filters.departmentId);

  const isFiltered = Boolean(filters.search || filters.status || filters.departmentId);

  function applyFilters() {
    const next = new URLSearchParams();
    if (search) next.set("search", search);
    if (status) next.set("status", status);
    if (departmentId) next.set("departmentId", departmentId);

    startTransition(() => {
      router.push(`/employees${next.toString() ? `?${next}` : ""}`);
    });
  }

  return (
    <>
      <PageHeader
        title="Employees"
        description={describeScope(role, orgName)}
      />

      <StatGrid>
        <StatCard
          icon={Users}
          label="On roll"
          value={summary.onRoll}
          sublabel={
            summary.departed > 0
              ? `${summary.total} on record · ${summary.departed} departed`
              : "Everyone currently employed"
          }
        />
        <StatCard
          icon={UserCheck}
          label="Active"
          value={summary.active}
          tone="success"
          sublabel={
            summary.probation > 0
              ? `${summary.probation} still on probation`
              : "Confirmed and working"
          }
        />
        <StatCard
          icon={UserMinus}
          label="Away"
          value={summary.onLeave + summary.noticePeriod}
          sublabel="On leave or serving notice, still on the roll"
        />
        <StatCard
          icon={LogOut}
          label="Departed"
          value={summary.departed}
          sublabel="Off headcount, records kept"
        />
        {summary.largestTeam ? (
          <StatCard
            icon={Building2}
            label="Largest team"
            value={<span className="text-2xl">{summary.largestTeam.name}</span>}
            sublabel={`${summary.largestTeam.count} ${
              summary.largestTeam.count === 1 ? "person" : "people"
            }`}
          />
        ) : null}
      </StatGrid>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="Search name, code or email"
            className="pl-9"
            aria-label="Search employees"
          />
        </div>

        {options.departments.length > 0 ? (
          <select
            value={departmentId}
            onChange={(e) => setDepartmentId(e.target.value)}
            aria-label="Filter by department"
            className="h-9 rounded-md border bg-surface px-3 text-sm"
          >
            <option value="">All departments</option>
            {options.departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          aria-label="Filter by status"
          className="h-9 rounded-md border bg-surface px-3 text-sm"
        >
          {STATUS_FILTERS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <Button onClick={applyFilters} disabled={pending}>
          {pending ? "Loading…" : "Show"}
        </Button>
      </div>

      <div className="overflow-hidden rounded-lg border bg-surface">
        {employees.length === 0 ? (
          <EmptyState
            className="border-0"
            icon={Users}
            title={isFiltered ? "No matches" : "Nobody here yet"}
            description={
              isFiltered
                ? "No employee matches those filters. Try a different name, code, or status."
                : "Once employees are added they appear here, with their department, status, and joining date."
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left">
                  <th className="eyebrow px-4 py-3 font-semibold">Employee</th>
                  <th className="eyebrow px-4 py-3 font-semibold">Designation</th>
                  <th className="eyebrow hidden px-4 py-3 font-semibold md:table-cell">
                    Department
                  </th>
                  <th className="eyebrow px-4 py-3 font-semibold">Status</th>
                  <th className="eyebrow hidden px-4 py-3 font-semibold sm:table-cell">
                    Joined
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {employees.map((row) => {
                  const rowStatus = row.employment?.status ?? "active";
                  return (
                    <tr key={row._id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link
                          href={`/employees/${row._id}`}
                          className="flex items-center gap-3"
                        >
                          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold">
                            {initialsOf(row.displayName)}
                          </span>
                          <span className="min-w-0">
                            <span className="block truncate font-medium">
                              {row.displayName}
                            </span>
                            <span className="tabular block truncate text-xs text-subtle-foreground">
                              {row.employeeCode}
                            </span>
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {row.designationId?.title ?? "—"}
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {row.departmentId?.name ?? "—"}
                      </td>
                      <td className="px-4 py-3">
                        <StatusPill tone={EMPLOYEE_STATUS_TONE[rowStatus] ?? "neutral"}>
                          {STATUS_LABEL[rowStatus] ?? rowStatus}
                        </StatusPill>
                      </td>
                      <td className="tabular hidden px-4 py-3 text-muted-foreground sm:table-cell">
                        {formatDate(row.employment?.dateOfJoining)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {pagination.total > employees.length ? (
        <p className="text-xs text-subtle-foreground">
          Showing {employees.length} of {pagination.total}.
        </p>
      ) : null}
    </>
  );
}
