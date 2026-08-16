// lib/format.ts
//
// Pure formatting helpers, safe to import from client components.
// (lib/services/payroll.ts pulls in Mongoose models, so it cannot be.)

/** Paise → "₹85,269". Indian digit grouping. */
export function formatINR(paise: number, withDecimals = false): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: withDecimals ? 2 : 0,
    maximumFractionDigits: withDecimals ? 2 : 0,
  }).format(paise / 100);
}

/** "2026-07" → "July 2026". */
export function monthLabel(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });
}

/** "2026-07" → "Jul 2026", for tight spaces like a select. */
export function monthLabelShort(month: string): string {
  const [year, m] = month.split("-").map(Number);
  return new Date(year, m - 1, 1).toLocaleDateString("en-IN", {
    month: "short",
    year: "numeric",
  });
}

export function formatDate(value?: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateLong(value?: string | Date | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

/** Minutes → "8h 45m". */
export function formatDuration(hours: number): string {
  const whole = Math.floor(hours);
  const minutes = Math.round((hours - whole) * 60);
  if (whole === 0) return `${minutes}m`;
  return minutes ? `${whole}h ${minutes}m` : `${whole}h`;
}
