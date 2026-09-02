import { randomBytes } from 'node:crypto';
import { createSupabaseAdmin } from './supabase';

/** Readable throwaway password, e.g. "court-a4f2-k9mx-7pqd". */
export function tempPassword(): string {
  const h = randomBytes(6).toString('hex');
  return `court-${h.slice(0, 4)}-${h.slice(4, 8)}-${h.slice(8, 12)}`;
}

export interface ClientAccount {
  id: string;
  isNew: boolean;
  tempPassword?: string; // set only when a new account was created
}

/**
 * Find the client behind an email, or create a Supabase auth account for them.
 * The `handle_new_user` trigger creates the matching profile row.
 */
export async function findOrCreateClient(input: {
  email: string;
  name: string;
  phone?: string | null;
}): Promise<ClientAccount> {
  const db = createSupabaseAdmin();
  const email = input.email.trim().toLowerCase();

  const lookup = () =>
    db.from('profiles').select('id').ilike('email', email).maybeSingle();

  const existing = await lookup();
  let id = existing.data?.id as string | undefined;
  let tempPass: string | undefined;
  const isNew = !id;

  if (!id) {
    tempPass = tempPassword();
    const { data, error } = await db.auth.admin.createUser({
      email,
      password: tempPass,
      email_confirm: true,
      user_metadata: { name: input.name },
    });
    if (error || !data.user) {
      // Lost a race with another booking for the same email — reuse that account.
      const retry = await lookup();
      if (!retry.data) throw error ?? new Error('Could not create an account for that email.');
      id = retry.data.id;
      tempPass = undefined;
    } else {
      id = data.user.id;
    }
  }

  await db
    .from('profiles')
    .update({ name: input.name || undefined, phone: input.phone || undefined })
    .eq('id', id);

  return { id: id!, isNew: isNew && !!tempPass, tempPassword: tempPass };
}
