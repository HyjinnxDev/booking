import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM } from 'astro:env/server';
import { bookingIcs, googleCalUrl, type IcsEvent } from './ics';
import { fmtLong } from './format';
import { BRAND, SITE_URL } from './config';

const FROM = EMAIL_FROM || `${BRAND} <bookings@technicourt.com>`;

const resend = new Resend(RESEND_API_KEY);

type SendArgs = Parameters<typeof resend.emails.send>[0];

// §1.9: escape every user-supplied string before it lands in HTML.
export const esc = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// §1.9 / §3.8: a plain-text alternative on every send (deliverability). Derived
// from the HTML — good enough; these mails are short and simple.
const toText = (html: string): string =>
  html
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Resend returns { error } instead of throwing; surface it so callers' try/catch
// logs it and cron doesn't mark a failed reminder as sent.
async function send(args: SendArgs & { html: string }) {
  const { data, error } = await resend.emails.send({ text: toText(args.html), ...args });
  if (error) throw new Error(`Resend: ${error.name} — ${error.message}`);
  return data;
}

export interface BookingMail {
  to: string;
  clientName: string;
  coachName: string;
  bookingId: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
  typeName?: string;
  locationName?: string | null;
  locationAddress?: string | null;
  /** ICS SEQUENCE — bump on every reschedule so clients see an update. */
  sequence?: number;
  /** Present only on the first booking, when we just created the account (§3.1). */
  newAccount?: { setPasswordUrl: string };
  /** Distinguishes a time change from a coach change (§2.16). */
  reason?: 'moved' | 'reassigned';
}

function summaryOf(m: BookingMail): string {
  return `${m.typeName || 'Tennis coaching'} with ${m.coachName}`;
}

function event(m: BookingMail): IcsEvent {
  return {
    id: m.bookingId,
    startAt: m.startAt,
    endAt: m.endAt,
    summary: summaryOf(m),
    description: m.notes || undefined,
    location: [m.locationName, m.locationAddress].filter(Boolean).join(', ') || undefined,
    sequence: m.sequence ?? 0,
    alarmMin: 60,
  };
}

function icsAttachment(ics: string) {
  return [{ filename: 'booking.ics', content: Buffer.from(ics, 'utf8').toString('base64') }];
}

// The booking id doubles as the manage-link token — no login needed.
function manageUrl(bookingId: string): string {
  return `${SITE_URL}/m/${bookingId}`;
}

function manageLine(bookingId: string, verb = 'Reschedule or cancel'): string {
  const u = manageUrl(bookingId);
  return `<p>${verb} this booking: <a href="${u}">${u.replace(/^https?:\/\//, '')}</a></p>`;
}

function whenBlock(m: BookingMail): string {
  const loc = [m.locationName, m.locationAddress].filter(Boolean).map(esc).join(' · ');
  const gcal = googleCalUrl({
    summary: summaryOf(m),
    startAt: m.startAt,
    endAt: m.endAt,
    location: [m.locationName, m.locationAddress].filter(Boolean).join(', ') || undefined,
    details: manageUrl(m.bookingId),
  });
  return `<p style="font-size:18px"><strong>${esc(fmtLong(m.startAt))}</strong></p>
    ${loc ? `<p style="color:#555">📍 ${loc}</p>` : ''}
    <p style="font-size:13px"><a href="${gcal}">Add to Google Calendar</a> · the attached file works everywhere else.</p>`;
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5">${body}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
    <p style="color:#888;font-size:13px">${esc(BRAND)} · tennis coaching</p>
  </div>`;
}

export async function sendConfirmation(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  const account = m.newAccount
    ? `<p style="background:#f4f4f2;border-radius:8px;padding:12px 14px">
         We also set up an account so you can see and manage all your bookings in one place —
         <a href="${m.newAccount.setPasswordUrl}">set a password</a> to sign in.
       </p>`
    : '';
  return send({
    from: FROM,
    to: m.to,
    subject: `Booking confirmed — ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${esc(m.clientName) || 'there'},</p>
       <p>Your ${esc(m.typeName || 'tennis session')} with <strong>${esc(m.coachName)}</strong> is confirmed:</p>
       ${whenBlock(m)}
       ${m.notes ? `<p>Your notes: ${esc(m.notes)}</p>` : ''}
       ${manageLine(m.bookingId)}
       ${account}`,
    ),
    attachments: icsAttachment(ics),
  });
}

export async function sendReschedule(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  const reassigned = m.reason === 'reassigned';
  return send({
    from: FROM,
    to: m.to,
    subject: reassigned
      ? `Coach change — ${fmtLong(m.startAt)}`
      : `Booking moved — ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${esc(m.clientName) || 'there'},</p>
       ${
         reassigned
           ? `<p>Your session is now with <strong>${esc(m.coachName)}</strong>, at the same time:</p>`
           : `<p>Your session with <strong>${esc(m.coachName)}</strong> has been moved to:</p>`
       }
       ${whenBlock(m)}
       ${m.notes ? `<p>Your notes: ${esc(m.notes)}</p>` : ''}
       <p>The attached file updates it in your calendar.</p>
       ${manageLine(m.bookingId)}`,
    ),
    attachments: icsAttachment(ics),
  });
}

export async function sendCancellation(m: BookingMail) {
  const ics = bookingIcs({ ...event(m), sequence: (m.sequence ?? 0) + 1 }, { method: 'CANCEL' });
  return send({
    from: FROM,
    to: m.to,
    subject: `Booking cancelled — ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${esc(m.clientName) || 'there'},</p>
       <p>Your session with <strong>${esc(m.coachName)}</strong> on <strong>${esc(fmtLong(m.startAt))}</strong> has been cancelled.</p>
       <p>The attached update removes it from your calendar. Book another time whenever you like.</p>`,
    ),
    attachments: icsAttachment(ics),
  });
}

export async function sendReminder(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  return send({
    from: FROM,
    to: m.to,
    subject: `Reminder — ${m.typeName || 'tennis'} soon, ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${esc(m.clientName) || 'there'},</p>
       <p>A reminder that your ${esc(m.typeName || 'session')} with <strong>${esc(m.coachName)}</strong> is coming up:</p>
       ${whenBlock(m)}
       ${m.notes ? `<p>Your notes: ${esc(m.notes)}</p>` : ''}
       ${manageLine(m.bookingId)}`,
    ),
    attachments: icsAttachment(ics),
  });
}

// §3.1: one link mechanism, three uses (guest booker, new coach, forgot password).
export async function sendSetPassword(m: { to: string; name: string; link: string; kind: 'welcome' | 'reset' | 'coach' }) {
  const intro =
    m.kind === 'coach'
      ? `An account has been set up for you to manage your ${BRAND} schedule.`
      : m.kind === 'reset'
        ? `Someone asked to reset the password for this email.`
        : `Set a password so you can sign in and manage your bookings.`;
  return send({
    from: FROM,
    to: m.to,
    subject: m.kind === 'reset' ? `Reset your ${BRAND} password` : `Set your ${BRAND} password`,
    html: shell(
      `<p>Hi ${esc(m.name) || 'there'},</p>
       <p>${esc(intro)}</p>
       <p style="background:#f4f4f2;border-radius:8px;padding:12px 14px">
         <a href="${m.link}">Set a password</a> — this link expires in an hour.
       </p>
       ${m.kind === 'reset' ? `<p style="color:#888;font-size:13px">If this wasn't you, you can ignore this email.</p>` : ''}
       ${
         m.kind === 'coach'
           ? `<p>From there you can set your hours, add session types and prices, schedule classes, and see your bookings.</p>`
           : ''
       }`,
    ),
  });
}

// Kept for compat — the staff-create path now uses sendSetPassword.
export async function sendStaffWelcome(m: { to: string; name: string; link: string }) {
  return sendSetPassword({ to: m.to, name: m.name, link: m.link, kind: 'coach' });
}

export async function sendWaitlistOpening(m: {
  to: string;
  clientName: string;
  className: string;
  startAt: string;
  occId: string;
}) {
  return send({
    from: FROM,
    to: m.to,
    subject: `A seat opened — ${m.className}, ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${esc(m.clientName) || 'there'},</p>
       <p>A seat just opened in <strong>${esc(m.className)}</strong> on <strong>${esc(fmtLong(m.startAt))}</strong>.</p>
       <p>It's first come, first served —
         <a href="${SITE_URL}/book?occ=${encodeURIComponent(m.occId)}">book your seat</a> before someone else does.</p>`,
    ),
  });
}

// §3.2: the coach hears about every booking event.
export async function sendCoachNotice(m: {
  to: string;
  coachName: string;
  kind: 'booked' | 'cancelled' | 'moved' | 'reassigned' | 'waitlist';
  clientName: string;
  startAt: string;
  typeName: string;
  bookingId?: string;
}) {
  const verb = {
    booked: 'New booking',
    cancelled: 'Cancellation',
    moved: 'Booking moved',
    reassigned: 'Booking reassigned to you',
    waitlist: 'Waitlist join',
  }[m.kind];
  return send({
    from: FROM,
    to: m.to,
    subject: `${verb} — ${m.typeName}, ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${esc(m.coachName) || 'there'},</p>
       <p><strong>${esc(verb)}</strong></p>
       <p>${esc(m.clientName || 'A client')} · ${esc(m.typeName)} · <strong>${esc(fmtLong(m.startAt))}</strong></p>
       ${m.bookingId ? `<p><a href="${manageUrl(m.bookingId)}">Open in the manager</a></p>` : ''}`,
    ),
  });
}

// §5: daily agenda for a coach, sent from the reminders cron.
export async function sendAgenda(m: { to: string; coachName: string; date: string; lines: string[] }) {
  return send({
    from: FROM,
    to: m.to,
    subject: `Tomorrow's agenda — ${m.date}`,
    html: shell(
      `<p>Hi ${esc(m.coachName) || 'there'},</p>
       <p>You have ${m.lines.length} session${m.lines.length === 1 ? '' : 's'} tomorrow (${esc(m.date)}):</p>
       <ul>${m.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>`,
    ),
  });
}
