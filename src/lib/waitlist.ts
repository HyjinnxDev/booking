import { createSupabaseAdmin } from './supabase';
import { sendWaitlistOpening } from './email';

/**
 * A seat may have opened in a class occurrence — email every waitlister who
 * hasn't been notified yet. First to book wins; the capacity trigger settles
 * the race. Best-effort: a send failure is logged, not surfaced.
 */
export async function notifyWaitlist(occId: string): Promise<void> {
  const db = createSupabaseAdmin();

  const { data: occ } = await db
    .from('class_occurrences')
    .select('id, start_at, capacity, status, variant:session_variant_id ( type:session_types ( name ) )')
    .eq('id', occId)
    .maybeSingle();
  if (!occ || occ.status !== 'scheduled') return;

  const { count: taken } = await db
    .from('bookings')
    .select('id', { count: 'exact', head: true })
    .eq('class_occurrence_id', occId)
    .eq('status', 'confirmed');
  if ((taken ?? 0) >= occ.capacity) return; // still full

  const { data: waiting } = await db
    .from('waitlist')
    .select('id, client:client_id ( name, email )')
    .eq('class_occurrence_id', occId)
    .is('notified_at', null)
    .order('created_at');
  if (!waiting || waiting.length === 0) return;

  const className = (occ as any).variant?.type?.name ?? 'your class';
  const now = new Date().toISOString();

  for (const w of waiting as any[]) {
    if (!w.client?.email) continue;
    try {
      await sendWaitlistOpening({
        to: w.client.email,
        clientName: w.client.name ?? '',
        className,
        startAt: occ.start_at,
        occId,
      });
      await db.from('waitlist').update({ notified_at: now }).eq('id', w.id);
    } catch (e) {
      console.error('waitlist notify failed for entry', w.id, e);
    }
  }
}
