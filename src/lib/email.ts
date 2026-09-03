import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM } from 'astro:env/server';
import { bookingIcs, type IcsEvent } from './ics';
import { fmtLong } from './format';
import { BRAND, SITE_URL } from './config';

const FROM = EMAIL_FROM || `${BRAND} <bookings@technicourt.com>`;

const resend = new Resend(RESEND_API_KEY);

type SendArgs = Parameters<typeof resend.emails.send>[0];

// Resend returns { error } instead of throwing; surface it so callers' try/catch
// logs it and cron doesn't mark a failed reminder as sent.
async function send(args: SendArgs) {
  const { data, error } = await resend.emails.send(args);
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
  /** ICS SEQUENCE — bump on every reschedule so clients see an update. */
  sequence?: number;
  /** Present only on the first booking, when we just created the account. */
  newAccount?: { tempPassword: string };
}

function event(m: BookingMail): IcsEvent {
  return {
    id: m.bookingId,
    startAt: m.startAt,
    endAt: m.endAt,
    summary: `Tennis coaching with ${m.coachName}`,
    description: m.notes || undefined,
    sequence: m.sequence ?? 0,
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
  return `<p>${verb} this booking: <a href="${manageUrl(bookingId)}">${manageUrl(bookingId).replace(/^https?:\/\//, '')}</a></p>`;
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5">${body}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
    <p style="color:#888;font-size:13px">${BRAND} · tennis coaching</p>
  </div>`;
}

export async function sendConfirmation(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  const account = m.newAccount
    ? `<p style="background:#f4f4f2;border-radius:8px;padding:12px 14px">
         We also set up an account so you can see all your bookings in one place — sign in at
         <a href="${SITE_URL}/login">${SITE_URL.replace(/^https?:\/\//, '')}/login</a>
         with this email and the temporary password
         <strong style="font-family:ui-monospace,monospace">${m.newAccount.tempPassword}</strong>.
       </p>`
    : '';
  return send({
    from: FROM,
    to: m.to,
    subject: `Booking confirmed — ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>Your tennis session with <strong>${m.coachName}</strong> is confirmed:</p>
       <p style="font-size:18px"><strong>${fmtLong(m.startAt)}</strong></p>
       ${m.notes ? `<p>Your notes: ${m.notes}</p>` : ''}
       <p>The attached file adds it to your calendar.</p>
       ${manageLine(m.bookingId)}
       ${account}`,
    ),
    attachments: icsAttachment(ics),
  });
}

export async function sendReschedule(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  return send({
    from: FROM,
    to: m.to,
    subject: `Booking moved — ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>Your session with <strong>${m.coachName}</strong> has been moved to:</p>
       <p style="font-size:18px"><strong>${fmtLong(m.startAt)}</strong></p>
       ${m.notes ? `<p>Your notes: ${m.notes}</p>` : ''}
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
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>Your session with <strong>${m.coachName}</strong> on <strong>${fmtLong(m.startAt)}</strong> has been cancelled.</p>
       <p>The attached update removes it from your calendar. Book another time whenever you like.</p>`,
    ),
    attachments: icsAttachment(ics),
  });
}

export async function sendStaffWelcome(m: { to: string; name: string; tempPassword: string }) {
  return send({
    from: FROM,
    to: m.to,
    subject: `Your ${BRAND} coach account`,
    html: shell(
      `<p>Hi ${m.name || 'there'},</p>
       <p>An account has been set up for you to manage your ${BRAND} schedule.</p>
       <p style="background:#f4f4f2;border-radius:8px;padding:12px 14px">
         Sign in at <a href="${SITE_URL}/login">${SITE_URL.replace(/^https?:\/\//, '')}/login</a>
         with this email and the temporary password
         <strong style="font-family:ui-monospace,monospace">${m.tempPassword}</strong>.
         Change it once you're in.
       </p>
       <p>From there you can set your hours, add session types and prices, schedule
          classes, and see your bookings.</p>`,
    ),
  });
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
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>A seat just opened in <strong>${m.className}</strong> on <strong>${fmtLong(m.startAt)}</strong>.</p>
       <p>It's first come, first served —
         <a href="${SITE_URL}/book?occ=${m.occId}">book your seat</a> before someone else does.</p>`,
    ),
  });
}

export async function sendReminder(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  return send({
    from: FROM,
    to: m.to,
    subject: `Reminder — tennis tomorrow, ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>A reminder that your session with <strong>${m.coachName}</strong> is coming up:</p>
       <p style="font-size:18px"><strong>${fmtLong(m.startAt)}</strong></p>
       ${m.notes ? `<p>Your notes: ${m.notes}</p>` : ''}
       ${manageLine(m.bookingId, 'Reschedule or cancel')}`,
    ),
    attachments: icsAttachment(ics),
  });
}
