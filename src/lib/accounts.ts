import { randomBytes } from 'node:crypto';
import { createSupabaseAdmin } from './supabase';
import { SITE_URL } from './config';
import { safeNext } from './url';

export interface ClientAccount {
  id: string;
  isNew: boolean;
  /** A one-hour "set a password" link, present only when a new account was created (§3.1). */
  setPasswordUrl?: string;
}

/**
 * §3.1: a server-side recovery link that lands on our own /auth/callback with a
 * `token_hash` query param (not a hash fragment), so the SSR client can call
 * verifyOtp and set the session cookie. Bypasses Supabase's rate-limited SMTP —
 * we send the link ourselves via Resend.
 */
export async function recoveryLink(email: string, next = '/account/password'): Promise<string | null> {
  const db = createSupabaseAdmin();
  const { data, error } = await db.auth.admin.generateLink({ type: 'recovery', email });
  const hashed = (data as any)?.properties?.hashed_token;
  if (error || !hashed) return null;
  const p = new URLSearchParams({ token_hash: hashed, type: 'recovery', next: safeNext(next, '/account/password') });
  return `${SITE_URL}/auth/callback?${p.toString()}`;
}

/**
 * Find the client behind an email, or create a Supabase auth account for them.
 * The `handle_new_user` trigger creates the matching profile row. New accounts
 * get a random throwaway password and a "set a password" link, never a plaintext one.
 */
export async function findOrCreateClient(input: {
  email: string;
  name: string;
  phone?: string | null;
}): Promise<ClientAccount> {
  const db = createSupabaseAdmin();
  const email = input.email.trim().toLowerCase();

  // §1.4: exact match on the normalised email.
  const lookup = () => db.from('profiles').select('id, name, phone').eq('email', email).maybeSingle();

  const existing = await lookup();
  let id = existing.data?.id as string | undefined;
  let cur = existing.data as { name?: string; phone?: string } | null;
  let created = false;

  if (!id) {
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: randomBytes(24).toString('hex'), // discarded — the user sets their own
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (error || !data.user) {
      // Lost a race with another booking for the same email — reuse that account.
      const retry = await lookup();
      if (!retry.data) throw error ?? new Error('Could not create an account for that email.');
      id = retry.data.id;
      cur = retry.data;
    } else {
      id = data.user.id;
      cur = null;
      created = true;
    }
  }

  // §2.6: never overwrite an existing client's name/phone from an unauth form.
  const patch: { name?: string; phone?: string } = {};
  if (input.name && !cur?.name) patch.name = input.name;
  if (input.phone && !cur?.phone) patch.phone = input.phone;
  if (Object.keys(patch).length) await db.from('profiles').update(patch).eq('id', id);

  return {
    id: id!,
    isNew: created,
    setPasswordUrl: created ? (await recoveryLink(email)) ?? undefined : undefined,
  };
}
