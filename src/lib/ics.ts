import { ICS_DOMAIN, BRAND } from './config';

export interface IcsEvent {
  id: string;
  startAt: string; // UTC ISO
  endAt: string; // UTC ISO
  summary: string;
  description?: string;
  sequence?: number;
}

function esc(s: string): string {
  return s.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

// UTC ISO -> 20260315T090000Z
function stamp(iso: string): string {
  return new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function vevent(e: IcsEvent, cancelled: boolean): string[] {
  const lines = [
    'BEGIN:VEVENT',
    `UID:booking-${e.id}@${ICS_DOMAIN}`,
    `DTSTAMP:${stamp(new Date().toISOString())}`,
    `DTSTART:${stamp(e.startAt)}`,
    `DTEND:${stamp(e.endAt)}`,
    `SUMMARY:${esc(e.summary)}`,
    `SEQUENCE:${e.sequence ?? 0}`,
    `STATUS:${cancelled ? 'CANCELLED' : 'CONFIRMED'}`,
  ];
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  lines.push('END:VEVENT');
  return lines;
}

// ponytail: no 75-octet line folding. Summaries/descriptions here are short;
// add folding if user-supplied notes start blowing the limit.

/** Single-event calendar for a booking email attachment. */
export function bookingIcs(e: IcsEvent, opts: { method?: 'REQUEST' | 'CANCEL' } = {}): string {
  const method = opts.method ?? 'REQUEST';
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${BRAND}//Bookings//EN`,
      'CALSCALE:GREGORIAN',
      `METHOD:${method}`,
      ...vevent(e, method === 'CANCEL'),
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  );
}

/** Multi-event feed for a coach's calendar subscription (read-only). */
export function coachFeedIcs(coachName: string, events: IcsEvent[]): string {
  return (
    [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      `PRODID:-//${BRAND}//Bookings//EN`,
      'CALSCALE:GREGORIAN',
      `X-WR-CALNAME:${esc(`${coachName} — ${BRAND}`)}`,
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      ...events.flatMap((e) => vevent(e, false)),
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  );
}
