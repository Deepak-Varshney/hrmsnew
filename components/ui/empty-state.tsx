import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export interface EmptyStateProps {
  icon?: LucideIcon;
  /** What is not here. "No flags this month", not "No data". */
  title: string;
  /**
   * Teach the feature. Say what would put something here, or what rule
   * governs it — "Flags appear once someone passes the late-arrival
   * threshold", "the day count skips weekends for you".
   *
   * An empty screen is the one moment you have the reader's full attention
   * and nothing competing for it. Spend it explaining, not apologising.
   */
  description: React.ReactNode;
  /** The action that fills the screen, when there is one. */
  action?: React.ReactNode;
  className?: string;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-lg border border-dashed px-6 py-14 text-center",
        className
      )}
    >
      {Icon ? (
        <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-muted">
          <Icon className="h-5 w-5 text-muted-foreground" aria-hidden />
        </div>
      ) : null}

      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-muted-foreground">
        {description}
      </p>

      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  );
}
