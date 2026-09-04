// Renders every email template to test/email-previews/*.html for eyeballing, and
// asserts each one produces a non-empty subject + html (breaks if a template
// throws or goes blank). Run: npm test , or  npm run email:preview
import { describe, it, expect, vi } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

// Capture the payload instead of hitting the Resend API.
const sent: any[] = [];
vi.mock('resend', () => ({
  Resend: class {
    emails = {
      send: async (args: any) => {
        sent.push(args);
        return { data: { id: 'preview' }, error: null };
      },
    };
  },
}));

const mail = await import('./email');

const start = '2026-09-20T04:30:00.000Z';
const end = '2026-09-20T05:30:00.000Z';
const booking = {
  to: 'sam@example.com',
  clientName: 'Sam Rivers',
  coachName: 'Coach Carla',
  bookingId: '11111111-1111-4111-8111-111111111111',
  startAt: start,
  endAt: end,
  notes: 'Working on my backhand slice.',
  typeName: 'Private lesson (60 min)',
  locationName: 'TechniCourt, Court 3',
  locationAddress: '12 Baseline Ave, Adelaide',
};
const link = 'https://bookings.technicourt.com/auth/callback?token_hash=abc';

const cases: Record<string, () => Promise<unknown>> = {
  'confirmation': () => mail.sendConfirmation(booking),
  'confirmation-new-account': () => mail.sendConfirmation({ ...booking, newAccount: { setPasswordUrl: link } }),
  'reschedule-moved': () => mail.sendReschedule({ ...booking, reason: 'moved', sequence: 1 }),
  'reschedule-reassigned': () => mail.sendReschedule({ ...booking, reason: 'reassigned', sequence: 1 }),
  'cancellation': () => mail.sendCancellation(booking),
  'reminder': () => mail.sendReminder(booking),
  'welcome': () => mail.sendSetPassword({ to: booking.to, name: booking.clientName, link, kind: 'welcome' }),
  'password-reset': () => mail.sendSetPassword({ to: booking.to, name: booking.clientName, link, kind: 'reset' }),
  'coach-account': () => mail.sendSetPassword({ to: booking.to, name: booking.coachName, link, kind: 'coach' }),
  'waitlist-opening': () => mail.sendWaitlistOpening({ to: booking.to, clientName: booking.clientName, className: 'Cardio Tennis', startAt: start, occId: 'occ-1' }),
  'coach-notice-booked': () => mail.sendCoachNotice({ to: booking.to, coachName: booking.coachName, kind: 'booked', clientName: booking.clientName, startAt: start, typeName: booking.typeName, bookingId: booking.bookingId }),
  'agenda': () => mail.sendAgenda({ to: booking.to, coachName: booking.coachName, date: 'Sat 20 Sep', lines: ['9:00am · Sam Rivers (Private lesson)', '10:30am · Cardio Tennis (4 booked)'] }),
};

const outDir = fileURLToPath(new URL('../../test/email-previews/', import.meta.url));
mkdirSync(outDir, { recursive: true });

describe('email templates', () => {
  for (const [name, run] of Object.entries(cases)) {
    it(`${name} renders`, async () => {
      sent.length = 0;
      await run();
      const { subject, html, text } = sent.at(-1)!;
      expect(subject).toBeTruthy();
      expect(html).toContain('TechniCourt');
      expect(html).not.toMatch(/[—–]/); // no em/en dashes in the rendered mail
      expect(text).toBeTruthy();
      // Emails are full HTML documents now: write the raw doc, plus a sidecar
      // .txt so the plain-text part is easy to eyeball.
      writeFileSync(`${outDir}${name}.html`, html);
      writeFileSync(`${outDir}${name}.txt`, `Subject: ${subject}\n\n${text}`);
    });
  }
});
