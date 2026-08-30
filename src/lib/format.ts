import { formatInTimeZone } from 'date-fns-tz';
import { BUSINESS_TZ } from './config';

/** "Monday 15 March 2026, 9:00 AM AEDT" — for emails and UI. */
export function fmtLong(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, "EEEE d MMMM yyyy, h:mm a zzz");
}

/** "9:00 AM" — slot buttons. */
export function fmtTime(iso: string): string {
  return formatInTimeZone(new Date(iso), BUSINESS_TZ, 'h:mm a');
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
