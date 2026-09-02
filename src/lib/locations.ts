import { createSupabaseAdmin } from './supabase';

export interface Location {
  id: string;
  name: string;
  address: string | null;
  timezone: string;
  active: boolean;
  sort: number;
}

const COLS = 'id, name, address, timezone, active, sort';

export async function listLocations(opts: { activeOnly?: boolean } = {}): Promise<Location[]> {
  const db = createSupabaseAdmin();
  let q = db.from('locations').select(COLS).order('sort').order('created_at');
  if (opts.activeOnly) q = q.eq('active', true);
  const { data } = await q;
  return (data ?? []) as Location[];
}
