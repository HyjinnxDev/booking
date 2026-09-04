import type { APIRoute } from 'astro';
import {
  sendConfirmation,
  sendReschedule,
  sendCancellation,
  sendReminder,
  sendSetPassword,
  sendWaitlistOpening,
  sendCoachNotice,
  sendAgenda,
} from '../../../lib/email';

// ponytail: dev-only. Sends one of every template to ?to=you@example.com so you
// can eyeball real inbox rendering (fonts, button, auto dark mode). 404 in prod.
// GET /api/dev/send-test-emails?to=me@example.com[&only=welcome]
export const GET: APIRoute = async ({ url }) => {
  if (!import.meta.env.DEV) return new Response('Not found', { status: 404 });
  const to = url.searchParams.get('to');
  const only = url.searchParams.get('only');
  if (!to) return new Response('Add ?to=you@example.com', { status: 400 });

  const start = new Date(Date.now() + 3 * 864e5).toISOString();
  const end = new Date(Date.now() + 3 * 864e5 + 36e5).toISOString();
  const b = {
    to,
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
  const link = `${url.origin}/auth/callback?token_hash=demo`;

  const jobs: Record<string, () => Promise<unknown>> = {
    confirmation: () => sendConfirmation({ ...b, newAccount: { setPasswordUrl: link } }),
    reschedule: () => sendReschedule({ ...b, reason: 'moved', sequence: 1 }),
    cancellation: () => sendCancellation(b),
    reminder: () => sendReminder(b),
    welcome: () => sendSetPassword({ to, name: b.clientName, link, kind: 'welcome' }),
    reset: () => sendSetPassword({ to, name: b.clientName, link, kind: 'reset' }),
    coach: () => sendSetPassword({ to, name: b.coachName, link, kind: 'coach' }),
    waitlist: () => sendWaitlistOpening({ to, clientName: b.clientName, className: 'Cardio Tennis', startAt: start, occId: 'occ-1' }),
    coachNotice: () => sendCoachNotice({ to, coachName: b.coachName, kind: 'booked', clientName: b.clientName, startAt: start, typeName: b.typeName, bookingId: b.bookingId }),
    agenda: () => sendAgenda({ to, coachName: b.coachName, date: 'Saturday 20 September', lines: ['9:00am · Sam Rivers (Private lesson)', '10:30am · Cardio Tennis (4 booked)'] }),
  };

  const picked = only ? { [only]: jobs[only] } : jobs;
  const results: Record<string, string> = {};
  for (const [name, run] of Object.entries(picked)) {
    if (!run) { results[name] = 'unknown template'; continue; }
    try {
      await run();
      results[name] = 'sent';
    } catch (e) {
      results[name] = `failed: ${(e as Error).message}`;
    }
  }
  return new Response(JSON.stringify(results, null, 2), { headers: { 'content-type': 'application/json' } });
};
