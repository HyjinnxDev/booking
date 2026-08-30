import { createSupabaseAdmin } from './supabase';

export interface Coach {
  id: string;
  name: string;
  email: string;
  cal_token: string;
}

// ponytail: v1 has one coach, so "the coach" = earliest-created coach profile.
// Multi-coach selection UI is v2; the schema already carries coach_id everywhere.
export async function getPrimaryCoach(): Promise<Coach | null> {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('profiles')
    .select('id, name, email, cal_token')
    .eq('role', 'coach')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle();
  return data as Coach | null;
}
