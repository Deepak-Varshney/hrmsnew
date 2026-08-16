import { cn } from "@/lib/utils";

export type PillTone =
  | "success"
  | "danger"
  | "warning"
  | "info"
  | "neutral"
  | "primary";

const SOFT: Record<PillTone, string> = {
  success: "bg-success/12 text-success",
  danger: "bg-danger/12 text-danger",
  warning: "bg-warning/12 text-warning",
  info: "bg-info/12 text-info",
  neutral: "bg-muted text-muted-foreground",
  primary: "bg-primary/12 text-primary",
};

const SOLID: Record<PillTone, string> = {
  success: "bg-success text-background",
  danger: "bg-danger text-white",
  warning: "bg-warning text-background",
  info: "bg-info text-background",
  neutral: "bg-muted text-foreground",
  primary: "bg-primary text-primary-foreground",
};

const OUTLINE: Record<PillTone, string> = {
  success: "border border-success/30 text-success",
  danger: "border border-danger/30 text-danger",
  warning: "border border-warning/30 text-warning",
  info: "border border-info/30 text-info",
  neutral: "border border-border text-muted-foreground",
  primary: "border border-primary/30 text-primary",
};

const DOT: Record<PillTone, string> = {
  success: "bg-success",
  danger: "bg-danger",
  warning: "bg-warning",
  info: "bg-info",
  neutral: "bg-muted-foreground",
  primary: "bg-primary",
};

export interface StatusPillProps {
  tone?: PillTone;
  variant?: "soft" | "solid" | "outline";
  dot?: boolean;
  children: React.ReactNode;
  className?: string;
}

/**
 * Status is always a pill, never bare text. A reader scanning a column of
 * fifty rows finds a shape and a colour far faster than a word.
 */
export function StatusPill({
  tone = "neutral",
  variant = "soft",
  dot = true,
  children,
  className,
}: StatusPillProps) {
  const styles =
    variant === "solid" ? SOLID[tone] : variant === "outline" ? OUTLINE[tone] : SOFT[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        styles,
        className
      )}
    >
      {dot ? (
        <span
          className={cn(
            "h-1.5 w-1.5 shrink-0 rounded-full",
            variant === "solid" ? "bg-current opacity-70" : DOT[tone]
          )}
          aria-hidden
        />
      ) : null}
      {children}
    </span>
  );
}

/** Map a domain status onto a tone, so the same word is always the same colour. */
export const ATTENDANCE_TONE: Record<string, PillTone> = {
  Present: "success",
  "Half Day": "warning",
  Absent: "danger",
  WFH: "info",
  OnDuty: "info",
  Weekend: "neutral",
  Holiday: "neutral",
  "Not marked": "neutral",
};

export const EMPLOYEE_STATUS_TONE: Record<string, PillTone> = {
  active: "primary",
  probation: "warning",
  "notice-period": "danger",
  "on-leave": "info",
  exited: "neutral",
};

export const LEAVE_STATUS_TONE: Record<string, PillTone> = {
  Approved: "success",
  Pending: "warning",
  Rejected: "danger",
  Cancelled: "neutral",
};
