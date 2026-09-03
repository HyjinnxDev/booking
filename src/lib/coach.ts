import { createSupabaseAdmin } from './supabase';

export interface Coach {
  id: string;
  name: string;
  email: string;
  cal_token: string;
}

// ponytail: v1 has one coach, so "the coach" = earliest-created coach profile.
// Multi-coach selection UI is v2; the schema already carries coach_id everywhere.
// Cached for the serverless instance lifetime — the coach row changes ~never and
// this runs on every booking page. Restart / redeploy clears it.
let cached: { coach: Coach | null; at: number } | null = null;
const TTL_MS = 5 * 60_000;

export async function getPrimaryCoach(): Promise<Coach | null> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.coach;
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('profiles')
    .select('id, name, email, cal_token')
    .eq('role', 'coach')
    .eq('active', true)
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  cached = { coach: (data as Coach | null) ?? null, at: Date.now() };
  return cached.coach;
}
