/**
 * Parse a due date string/Date without UTC timezone offset.
 *
 * When MySQL stores a DATE column (e.g. "2026-04-19") and Drizzle returns it
 * as a Date object or ISO string, JavaScript's `new Date("2026-04-19")` treats
 * it as UTC midnight — which in GMT-4 becomes "2026-04-18T20:00:00", shifting
 * the date one day back.
 *
 * This function always returns a Date at LOCAL midnight for the given date,
 * regardless of the input's timezone suffix.
 */
export function parseDueDate(dueDate: string | Date | null | undefined): Date | null {
  if (!dueDate) return null;

  // If it's already a Date object, extract local year/month/day components
  if (dueDate instanceof Date) {
    // Use UTC components because Drizzle Date objects from MySQL DATE columns
    // are set to UTC midnight — we want the calendar date, not local time
    return new Date(dueDate.getUTCFullYear(), dueDate.getUTCMonth(), dueDate.getUTCDate());
  }

  // String: try to extract YYYY-MM-DD portion to avoid UTC parsing
  const match = String(dueDate).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  }

  // Fallback: parse normally (may have timezone issues)
  const d = new Date(dueDate);
  return isNaN(d.getTime()) ? null : new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

/**
 * Returns today's date at LOCAL midnight (no time component).
 */
export function todayLocal(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

/**
 * Returns the number of calendar days between two local dates.
 * Positive = future, negative = past, 0 = same day.
 */
export function diffCalendarDays(from: Date, to: Date): number {
  return Math.round((to.getTime() - from.getTime()) / 86_400_000);
}

/**
 * Returns a colored badge config for a due date.
 * Returns null if no dueDate or task is done.
 */
export function getDueDateBadgeConfig(
  dueDate: string | Date | null | undefined,
  isDone: boolean
): { label: string; className: string } | null {
  if (!dueDate || isDone) return null;

  const due = parseDueDate(dueDate);
  if (!due) return null;

  const today = todayLocal();
  const diff = diffCalendarDays(today, due);
  const label = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  if (diff < 0) return { label: `Overdue · ${label}`, className: "bg-red-100 text-red-700 border-red-200" };
  if (diff === 0) return { label: "Today", className: "bg-amber-100 text-amber-700 border-amber-200" };
  if (diff === 1) return { label: `Tomorrow · ${label}`, className: "bg-orange-100 text-orange-700 border-orange-200" };
  return { label, className: "bg-slate-100 text-slate-600 border-slate-200" };
}
