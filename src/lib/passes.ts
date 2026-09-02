import { createSupabaseAdmin } from './supabase';

export interface Pass {
  id: string;
  client_id: string;
  session_type_id: string | null;
  name: string;
  total: number;
  used: number;
  price_cents: number;
  status: 'active' | 'void';
  expires_at: string | null;
}

const COLS = 'id, client_id, session_type_id, name, total, used, price_cents, status, expires_at';

/** Passes a client can still redeem — active, credit left, not expired. */
export async function activePassesForClient(clientId: string): Promise<Pass[]> {
  const db = createSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await db
    .from('passes')
    .select(COLS)
    .eq('client_id', clientId)
    .eq('status', 'active')
    .order('created_at');
  return ((data ?? []) as Pass[]).filter(
    (p) => p.used < p.total && (!p.expires_at || p.expires_at >= today),
  );
}

/** Does this pass cover a booking of `sessionTypeId`? (null session_type_id = any.) */
export function passCovers(p: Pass, sessionTypeId: string): boolean {
  return p.session_type_id === null || p.session_type_id === sessionTypeId;
}
