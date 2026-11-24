/**
 * "Today" and "this month" in the user's time zone (#327).
 *
 * `new Date().toISOString()` is UTC: from 7 PM EST (8 PM EDT) on, its date is
 * tomorrow in Florida. Anything the user reads as today (a document's date, a
 * form's default date, a filename, "is this invoice overdue yet") uses these.
 * Instants (created_at, sent_at, …) stay toISOString(); calendar arithmetic
 * done entirely in UTC (parse at T00:00:00Z, add days, format) is fine too.
 */
const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD of `d` in the local time zone. */
export function localDateStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** YYYY-MM of `d` in the local time zone. */
export function localMonthStamp(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}
