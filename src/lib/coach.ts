import { createSupabaseAdmin } from './supabase';

export interface Coach {
  id: string;
  name: string;
  email: string;
  cal_token: string;
  bio: string | null;
}

/** A single coach's profile by id, or null. */
export async function getCoachProfile(id: string): Promise<Coach | null> {
  const db = createSupabaseAdmin();
  // §3.6: an admin can also coach.
  const { data } = await db
    .from('profiles')
    .select('id, name, email, cal_token, bio')
    .eq('id', id)
    .in('role', ['coach', 'admin'])
    .maybeSingle();
  return (data as Coach | null) ?? null;
}
