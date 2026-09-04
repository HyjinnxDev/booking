import { ICS_DOMAIN, BRAND } from './config';

export interface IcsEvent {
  id: string;
  startAt: string; // UTC ISO
  endAt: string; // UTC ISO
  summary: string;
  description?: string;
  location?: string;
  sequence?: number;
  /** Minutes before start for a VALARM. Omitted = no alarm. */
  alarmMin?: number;
}

function esc(s: string): string {
  return s.replace(/([\\;,])/g, '\\$1').replace(/\r?\n/g, '\\n');
}

// §3.8: RFC 5545 content lines must be folded at 75 octets. Notes go up to 500
// chars, so this is needed now. Continuation lines start with a single space.
function fold(line: string): string {
  if (line.length <= 74) return line;
  return line.match(/.{1,74}/g)!.join('\r\n ');
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
  if (e.location) lines.push(`LOCATION:${esc(e.location)}`);
  if (e.description) lines.push(`DESCRIPTION:${esc(e.description)}`);
  const out = lines.map(fold);
  if (e.alarmMin && !cancelled) {
    out.push(
      'BEGIN:VALARM',
      'ACTION:DISPLAY',
      `DESCRIPTION:${esc(e.summary)}`,
      `TRIGGER:-PT${e.alarmMin}M`,
      'END:VALARM',
    );
  }
  out.push('END:VEVENT');
  return out;
}

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
      fold(`X-WR-CALNAME:${esc(`${coachName}, ${BRAND}`)}`),
      'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
      'X-PUBLISHED-TTL:PT1H',
      ...events.flatMap((e) => vevent(e, false)),
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'
  );
}

/** "Add to Google Calendar" URL, friendlier than an .ics on a phone (§3.8). */
export function googleCalUrl(e: {
  summary: string;
  startAt: string;
  endAt: string;
  location?: string;
  details?: string;
}): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.summary,
    dates: `${stamp(e.startAt)}/${stamp(e.endAt)}`,
  });
  if (e.location) p.set('location', e.location);
  if (e.details) p.set('details', e.details);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}
