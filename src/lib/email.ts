import { Resend } from 'resend';
import { RESEND_API_KEY, EMAIL_FROM } from 'astro:env/server';
import { bookingIcs, googleCalUrl, type IcsEvent } from './ics';
import { fmtLong } from './format';
import { BRAND, SITE_URL } from './config';

const FROM = EMAIL_FROM || `${BRAND} <bookings@technicourt.com>`;
const HOST = SITE_URL.replace(/^https?:\/\//, '');

const resend = new Resend(RESEND_API_KEY);

type SendArgs = Parameters<typeof resend.emails.send>[0];

// §1.9: escape every user-supplied string before it lands in HTML.
export const esc = (s: string | null | undefined): string =>
  String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// Brand tokens, mirrored from src/styles/global.css. Inlined on every element
// because most clients strip <style>; the document <style> block only carries
// progressive polish (web fonts, small-screen padding) that Outlook ignores safely.
const C = {
  paper: '#fcfbf9',
  card: '#ffffff',
  border: '#e6e3dc',
  ink: '#17181a',
  body: '#3b3c3e',
  soft: '#727471',
  ball: '#d8ed57',
};
const SANS =
  "'Hanken Grotesk',-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const DISPLAY = `'Bricolage Grotesque',${SANS}`;

// §1.9 / §3.8: a plain-text alternative on every send (deliverability). Derived
// from the HTML, after dropping the parts that are markup-only.
const toText = (html: string): string =>
  html
    .replace(/<head[\s\S]*?<\/head>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div class="preheader"[\s\S]*?<\/div>/gi, '')
    .replace(/<a[^>]+href="([^"]+)"[^>]*>(.*?)<\/a>/gi, '$2 ($1)')
    .replace(/<\/(p|div|h[1-6]|li|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ').replace(/&copy;/g, '(c)')
    .replace(/[ \t]*\n[ \t]*/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

// Resend returns { error } instead of throwing; surface it so callers' try/catch
// logs it and cron doesn't mark a failed reminder as sent.
async function send(args: SendArgs & { html: string }) {
  const { data, error } = await resend.emails.send({ text: toText(args.html), ...args });
  if (error) throw new Error(`Resend: ${error.name}: ${error.message}`);
  return data;
}

/* ---------------------------------------------------------------------------
   Layout primitives. Table-based, inline-styled, 600px. Every mail is
   header wordmark + white card + quiet footer, on the warm paper ground.
   --------------------------------------------------------------------------- */

function h1(text: string): string {
  return `<h1 style="margin:0 0 18px;font-family:${DISPLAY};font-size:23px;line-height:1.3;letter-spacing:-0.02em;font-weight:600;color:${C.ink}">${text}</h1>`;
}

function p(html: string, opt: { small?: boolean; soft?: boolean } = {}): string {
  const size = opt.small ? '13px' : '16px';
  const color = opt.soft ? C.soft : C.body;
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:${size};line-height:1.6;color:${color}">${html}</p>`;
}

function a(href: string, text: string, color = C.ink): string {
  return `<a href="${href}" style="color:${color};text-decoration:underline">${text}</a>`;
}

// Bulletproof button: real background on the <td>, padding on the <a>, so it
// survives Outlook without VML for a shape this simple.
function button(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:6px 0 4px">
    <tr><td bgcolor="${C.ink}" style="border-radius:10px">
      <a href="${href}" style="display:inline-block;padding:14px 30px;font-family:${SANS};font-size:15px;font-weight:600;line-height:1;color:${C.paper};text-decoration:none;border-radius:10px">${label}</a>
    </td></tr></table>`;
}

// Accent panel: a lime spine on the left, warm fill, for the "when / where".
function panel(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0">
    <tr>
      <td width="4" style="width:4px;background:${C.ball};border-radius:4px 0 0 4px">&nbsp;</td>
      <td style="background:${C.paper};border:1px solid ${C.border};border-left:none;border-radius:0 10px 10px 0;padding:18px 20px">${inner}</td>
    </tr></table>`;
}

// Plain bordered callout, no accent spine, for secondary asides.
function callout(inner: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:22px 0">
    <tr><td style="background:${C.paper};border:1px solid ${C.border};border-radius:12px;padding:20px 22px">${inner}</td></tr></table>`;
}

function shell(opt: { preheader: string; body: string }): string {
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only">
<title>${esc(BRAND)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600&family=Hanken+Grotesk:wght@400;600&display=swap" rel="stylesheet">
<style>
  body{margin:0;padding:0;background:${C.paper};-webkit-font-smoothing:antialiased}
  @media (max-width:620px){
    .card{padding:26px 22px!important}
    .wrap{padding:24px 12px!important}
  }
</style>
</head>
<body>
<div class="preheader" style="display:none;max-height:0;overflow:hidden;mso-hide:all;opacity:0">${esc(opt.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.paper}">
  <tr><td align="center" class="wrap" style="padding:44px 16px">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:600px;max-width:100%">
      <tr><td style="padding:0 4px 20px">
        <span style="font-family:${DISPLAY};font-size:19px;font-weight:600;letter-spacing:-0.02em;color:${C.ink}">${esc(BRAND)}</span><span style="display:inline-block;width:7px;height:7px;border-radius:50%;background:${C.ball};margin-left:4px"></span>
      </td></tr>
      <tr><td class="card" style="background:${C.card};border:1px solid ${C.border};border-radius:16px;padding:40px">
        ${opt.body}
      </td></tr>
      <tr><td style="padding:22px 8px 0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.soft}">
        &copy; ${new Date().getFullYear()} ${esc(BRAND)}. All rights reserved.<br>
        You are getting this because you have a booking or an account with us.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`;
}

/* ------------------------------------------------------------------------- */

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
  /** ICS SEQUENCE: bump on every reschedule so clients see an update. */
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

// The booking id doubles as the manage-link token, no login needed.
function manageUrl(bookingId: string): string {
  return `${SITE_URL}/m/${bookingId}`;
}

function notesLine(m: BookingMail): string {
  return m.notes ? p(`<strong style="color:${C.ink}">Your notes.</strong> ${esc(m.notes)}`, { small: true }) : '';
}

function whenBlock(m: BookingMail): string {
  const loc = [m.locationName, m.locationAddress].filter(Boolean).map(esc).join(', ');
  const gcal = googleCalUrl({
    summary: summaryOf(m),
    startAt: m.startAt,
    endAt: m.endAt,
    location: [m.locationName, m.locationAddress].filter(Boolean).join(', ') || undefined,
    details: manageUrl(m.bookingId),
  });
  const mapHref = m.locationAddress
    ? `https://maps.google.com/?q=${encodeURIComponent(m.locationAddress)}`
    : null;
  return panel(
    `<p style="margin:0 0 6px;font-family:${DISPLAY};font-size:19px;line-height:1.3;color:${C.ink}">${esc(fmtLong(m.startAt))}</p>
     ${
       loc
         ? `<p style="margin:0 0 12px;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.soft}">${mapHref ? `<a href="${mapHref}" style="color:${C.soft};text-decoration:underline">${loc}</a>` : loc}</p>`
         : ''
     }
     <p style="margin:0;font-family:${SANS};font-size:13px;line-height:1.5">${a(gcal, 'Add to Google Calendar')}<span style="color:${C.soft}">&nbsp;&nbsp;·&nbsp;&nbsp;the attached file covers Apple and Outlook</span></p>`,
  );
}

export async function sendConfirmation(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  const account = m.newAccount
    ? callout(
        `${p(`We set up an account so you can see and manage every booking in one place.`)}${button(m.newAccount.setPasswordUrl, 'Set your password')}`,
      )
    : '';
  return send({
    from: FROM,
    to: m.to,
    subject: `Booking confirmed for ${fmtLong(m.startAt)}`,
    html: shell({
      preheader: `Your ${m.typeName || 'session'} with ${m.coachName} on ${fmtLong(m.startAt)} is confirmed.`,
      body:
        h1(`You are booked in`) +
        p(`Hi ${esc(m.clientName) || 'there'}, your ${esc(m.typeName || 'tennis session')} with <strong style="color:${C.ink}">${esc(m.coachName)}</strong> is confirmed.`) +
        whenBlock(m) +
        notesLine(m) +
        button(manageUrl(m.bookingId), 'View or change this booking') +
        account,
    }),
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
      ? `Your coach has changed for ${fmtLong(m.startAt)}`
      : `Your booking has moved to ${fmtLong(m.startAt)}`,
    html: shell({
      preheader: reassigned
        ? `Your session on ${fmtLong(m.startAt)} is now with ${m.coachName}.`
        : `Your session with ${m.coachName} is now on ${fmtLong(m.startAt)}.`,
      body:
        h1(reassigned ? `Your coach has changed` : `Your booking has moved`) +
        p(
          reassigned
            ? `Hi ${esc(m.clientName) || 'there'}, your session is now with <strong style="color:${C.ink}">${esc(m.coachName)}</strong>, at the same time.`
            : `Hi ${esc(m.clientName) || 'there'}, your session with <strong style="color:${C.ink}">${esc(m.coachName)}</strong> has been moved.`,
        ) +
        whenBlock(m) +
        notesLine(m) +
        p(`The attached file updates the booking in your calendar.`, { small: true, soft: true }) +
        button(manageUrl(m.bookingId), 'View or change this booking'),
    }),
    attachments: icsAttachment(ics),
  });
}

export async function sendCancellation(m: BookingMail) {
  const ics = bookingIcs({ ...event(m), sequence: (m.sequence ?? 0) + 1 }, { method: 'CANCEL' });
  return send({
    from: FROM,
    to: m.to,
    subject: `Booking cancelled: ${fmtLong(m.startAt)}`,
    html: shell({
      preheader: `Your session with ${m.coachName} on ${fmtLong(m.startAt)} has been cancelled.`,
      body:
        h1(`Booking cancelled`) +
        p(`Hi ${esc(m.clientName) || 'there'}, your session with <strong style="color:${C.ink}">${esc(m.coachName)}</strong> on <strong style="color:${C.ink}">${esc(fmtLong(m.startAt))}</strong> has been cancelled.`) +
        p(`The attached update removes it from your calendar. You can book another time whenever you like.`, { small: true, soft: true }) +
        button(`${SITE_URL}/`, 'Book another session'),
    }),
    attachments: icsAttachment(ics),
  });
}

export async function sendReminder(m: BookingMail) {
  const ics = bookingIcs(event(m), { method: 'REQUEST' });
  return send({
    from: FROM,
    to: m.to,
    subject: `Reminder: ${m.typeName || 'your session'} on ${fmtLong(m.startAt)}`,
    html: shell({
      preheader: `Your ${m.typeName || 'session'} with ${m.coachName} is coming up on ${fmtLong(m.startAt)}.`,
      body:
        h1(`See you soon`) +
        p(`Hi ${esc(m.clientName) || 'there'}, a reminder that your ${esc(m.typeName || 'session')} with <strong style="color:${C.ink}">${esc(m.coachName)}</strong> is coming up.`) +
        whenBlock(m) +
        notesLine(m) +
        button(manageUrl(m.bookingId), 'View or change this booking'),
    }),
    attachments: icsAttachment(ics),
  });
}

// §3.1: one link mechanism, three uses (guest booker, new coach, forgot password).
export async function sendSetPassword(m: { to: string; name: string; link: string; kind: 'welcome' | 'reset' | 'coach' }) {
  const subject = {
    welcome: `Welcome to ${BRAND}`,
    reset: `Reset your ${BRAND} password`,
    coach: `Set up your ${BRAND} coach account`,
  }[m.kind];

  const heading = {
    welcome: `Welcome to ${esc(BRAND)}`,
    reset: `Reset your password`,
    coach: `Your coach account is ready`,
  }[m.kind];

  const intro = {
    welcome: `We set up an account for you so you can see and manage your bookings in one place.`,
    reset: `Someone asked to reset the password for this email address.`,
    coach: `An account has been set up for you to run your ${esc(BRAND)} schedule.`,
  }[m.kind];

  const cta = m.kind === 'reset' ? 'Choose a new password' : 'Set your password';

  const perks = {
    welcome: p(`Once you are in you can review upcoming sessions, reschedule or cancel, book again in a couple of taps, and check any pass balances.`),
    coach: p(`From there you can set your hours, add session types and prices, schedule classes, and see your bookings.`),
    reset: '',
  }[m.kind];

  return send({
    from: FROM,
    to: m.to,
    subject,
    html: shell({
      preheader: intro,
      body:
        h1(heading) +
        p(`Hi ${esc(m.name) || 'there'}, ${intro[0].toLowerCase()}${intro.slice(1)}`) +
        button(m.link, cta) +
        p(`This link expires in an hour. If it does, request a fresh one at ${a(`${SITE_URL}/forgot`, `${HOST}/forgot`)}.`, { small: true, soft: true }) +
        perks +
        (m.kind === 'reset'
          ? p(`If this was not you, you can ignore this email. Your password will not change.`, { small: true, soft: true })
          : ''),
    }),
  });
}

// Kept for compat: the staff-create path now uses sendSetPassword.
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
    subject: `A seat opened in ${m.className} on ${fmtLong(m.startAt)}`,
    html: shell({
      preheader: `A place opened in ${m.className} on ${fmtLong(m.startAt)}. First to book keeps it.`,
      body:
        h1(`A seat just opened`) +
        p(`Hi ${esc(m.clientName) || 'there'}, a place opened in <strong style="color:${C.ink}">${esc(m.className)}</strong> on <strong style="color:${C.ink}">${esc(fmtLong(m.startAt))}</strong>.`) +
        p(`It is first come, first served, so book now if you still want it.`, { small: true, soft: true }) +
        button(`${SITE_URL}/book?occ=${encodeURIComponent(m.occId)}`, 'Book this seat'),
    }),
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
    subject: `${verb}: ${m.typeName}, ${fmtLong(m.startAt)}`,
    html: shell({
      preheader: `${m.clientName || 'A client'}, ${m.typeName}, ${fmtLong(m.startAt)}`,
      body:
        h1(esc(verb)) +
        p(`Hi ${esc(m.coachName) || 'there'}, here is the latest on your schedule.`) +
        panel(
          `<p style="margin:0 0 4px;font-family:${DISPLAY};font-size:18px;line-height:1.3;color:${C.ink}">${esc(m.clientName || 'A client')}</p>
           <p style="margin:0;font-family:${SANS};font-size:14px;line-height:1.5;color:${C.soft}">${esc(m.typeName)}<br>${esc(fmtLong(m.startAt))}</p>`,
        ) +
        (m.bookingId ? button(manageUrl(m.bookingId), 'Open in the manager') : ''),
    }),
  });
}

// Admin broadcast to clients or coaches. Plain text in, escaped + line breaks
// out — no rich formatting, this is an announcement, not a template.
export async function sendBroadcast(m: { to: string; subject: string; body: string }) {
  const bodyHtml = esc(m.body).replace(/\n/g, '<br>');
  return send({
    from: FROM,
    to: m.to,
    subject: m.subject,
    html: shell({
      preheader: m.body.slice(0, 140),
      body: h1(esc(m.subject)) + p(bodyHtml),
    }),
  });
}

// §5: daily agenda for a coach, sent from the reminders cron.
export async function sendAgenda(m: { to: string; coachName: string; date: string; lines: string[] }) {
  const rows = m.lines
    .map(
      (l) =>
        `<tr><td style="padding:12px 0;border-bottom:1px solid ${C.border};font-family:${SANS};font-size:15px;line-height:1.5;color:${C.body}">${esc(l)}</td></tr>`,
    )
    .join('');
  return send({
    from: FROM,
    to: m.to,
    subject: `Your agenda for ${m.date}`,
    html: shell({
      preheader: `${m.lines.length} session${m.lines.length === 1 ? '' : 's'} tomorrow, ${m.date}.`,
      body:
        h1(`Tomorrow's sessions`) +
        p(`Hi ${esc(m.coachName) || 'there'}, you have ${m.lines.length} session${m.lines.length === 1 ? '' : 's'} tomorrow, ${esc(m.date)}.`) +
        `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px">${rows}</table>`,
    }),
  });
}
