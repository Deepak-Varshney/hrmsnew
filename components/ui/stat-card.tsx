import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type StatTone = "default" | "success" | "danger" | "info" | "warning";

const VALUE_TONE: Record<StatTone, string> = {
  default: "text-foreground",
  success: "text-success",
  danger: "text-danger",
  info: "text-info",
  warning: "text-warning",
};

export interface StatCardProps {
  icon?: LucideIcon;
  label: string;
  value: React.ReactNode;
  /**
   * The line under the value that explains what it is made of —
   * "3 on record · 1 departed", "Off headcount, records kept".
   *
   * Fill this in wherever the number has a composition or a caveat. A figure
   * with no explanation makes the reader guess, and they usually guess wrong.
   */
  sublabel?: React.ReactNode;
  tone?: StatTone;
  className?: string;
}

export function StatCard({
  icon: Icon,
  label,
  value,
  sublabel,
  tone = "default",
  className,
}: StatCardProps) {
  return (
    <div
      className={cn(
        "rounded-lg border bg-surface p-4 transition-colors hover:bg-surface-raised",
        className
      )}
    >
      <div className="flex items-center gap-2">
        {Icon ? (
          <Icon className="h-3.5 w-3.5 shrink-0 text-subtle-foreground" aria-hidden />
        ) : null}
        <span className="eyebrow">{label}</span>
      </div>

      <div
        className={cn(
          "tabular mt-3 text-3xl font-semibold leading-none tracking-tight",
          VALUE_TONE[tone]
        )}
      >
        {value}
      </div>

      {sublabel ? (
        <p className="mt-2 text-xs leading-relaxed text-subtle-foreground">{sublabel}</p>
      ) : null}
    </div>
  );
}

/** Responsive grid sized for stat cards. */
export function StatGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4",
        className
      )}
    >
      {children}
    </div>
  );
}
