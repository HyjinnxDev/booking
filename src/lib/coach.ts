import { createSupabaseAdmin } from './supabase';

export interface Coach {
  id: string;
  name: string;
  email: string;
  cal_token: string;
}

/** A single coach's profile by id, or null. */
export async function getCoachProfile(id: string): Promise<Coach | null> {
  const db = createSupabaseAdmin();
  const { data } = await db
    .from('profiles')
    .select('id, name, email, cal_token')
    .eq('id', id)
    .eq('role', 'coach')
    .maybeSingle();
  return (data as Coach | null) ?? null;
}
