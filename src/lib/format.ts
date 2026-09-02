import { formatInTimeZone } from 'date-fns-tz';
import { BUSINESS_TZ } from './config';

/** "Monday 15 March 2026, 9:00am" — for emails and UI. Business-local, no tz label. */
export function fmtLong(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'EEEE d MMMM yyyy, h:mmaaa');
}

/** "9:00am" — slot buttons. */
export function fmtTime(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'h:mmaaa');
}

/** "2026-03-15" in the business timezone. */
export function todayStr(): string {
  return formatInTimeZone(new Date(), BUSINESS_TZ, 'yyyy-MM-dd');
}

/** Add days to a YYYY-MM-DD string. */
export function addDaysStr(dateStr: string, days: number): string {
  const d = new Date(`${dateStr}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Format a bare YYYY-MM-DD by its calendar value, e.g. calFmt('2026-08-31', 'EEEE d MMMM'). */
export function calFmt(dateStr: string, pattern: string): string {
  return formatInTimeZone(new Date(`${dateStr}T12:00:00Z`), 'UTC', pattern);
}

/** "$40", "$37.50", or "Free". */
export function fmtPrice(cents: number): string {
  if (!cents) return 'Free';
  return `$${(cents / 100).toFixed(2).replace(/\.00$/, '')}`;
}

/** Dollars string -> integer cents. "40" -> 4000, "" -> 0. */
export function parsePrice(s: string): number {
  return Math.round(parseFloat(s || '0') * 100) || 0;
}
