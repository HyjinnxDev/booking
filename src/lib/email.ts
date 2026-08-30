import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM } from 'astro:env/server';
import { bookingIcs, type IcsEvent } from './ics';
import { fmtLong } from './format';
import { BRAND, SITE_URL } from './config';

const FROM = EMAIL_FROM || `${BRAND} <bookings@technicourt.com>`;

function client(): Resend {
  return new Resend(RESEND_API_KEY);
}

export interface BookingMail {
  to: string;
  clientName: string;
  coachName: string;
  bookingId: string;
  startAt: string;
  endAt: string;
  notes?: string | null;
}

function event(m: BookingMail): IcsEvent {
  return {
    id: m.bookingId,
    startAt: m.startAt,
    endAt: m.endAt,
    summary: `Tennis coaching with ${m.coachName}`,
    description: m.notes || undefined,
  };
}

function icsAttachment(ics: string) {
  return [{ filename: 'booking.ics', content: Buffer.from(ics, 'utf8').toString('base64') }];
}

function shell(body: string): string {
  return `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5">${body}
    <hr style="border:none;border-top:1px solid #ddd;margin:24px 0">
    <p style="color:#888;font-size:13px">${BRAND} · <a href="${SITE_URL}/bookings">Manage your bookings</a></p>
  </div>`;
}

export async function sendConfirmation(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  return client().emails.send({
    from: FROM,
    to: m.to,
    subject: `Booking confirmed — ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>Your tennis session with <strong>${m.coachName}</strong> is confirmed:</p>
       <p style="font-size:18px"><strong>${fmtLong(m.startAt)}</strong></p>
       ${m.notes ? `<p>Your notes: ${m.notes}</p>` : ''}
       <p>The attached file adds it to your calendar. To cancel, use the link below.</p>`,
    ),
    attachments: icsAttachment(ics),
  });
}

export async function sendCancellation(m: BookingMail) {
  const ics = bookingIcs({ ...event(m), sequence: 1 }, { method: 'CANCEL' });
  return client().emails.send({
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

export async function sendReminder(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  return client().emails.send({
    from: FROM,
    to: m.to,
    subject: `Reminder — tennis tomorrow, ${fmtLong(m.startAt)}`,
    html: shell(
      `<p>Hi ${m.clientName || 'there'},</p>
       <p>A reminder that your session with <strong>${m.coachName}</strong> is coming up:</p>
       <p style="font-size:18px"><strong>${fmtLong(m.startAt)}</strong></p>
       ${m.notes ? `<p>Your notes: ${m.notes}</p>` : ''}
       <p>Need to cancel? Use the link below.</p>`,
    ),
    attachments: icsAttachment(ics),
  });
}
