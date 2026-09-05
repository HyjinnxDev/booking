import { createSupabaseAdmin } from './supabase';

/** Fire-and-forget: an audit failure should never break the action it's logging. */
export async function logAudit(actorId: string | null, action: string, meta: Record<string, unknown> = {}) {
  try {
    await createSupabaseAdmin().from('audit_log').insert({ actor_id: actorId, action, meta });
  } catch (e) {
    console.error('audit log failed', action, e);
  }
}
