import type { APIRoute } from 'astro';
import { createSupabaseAdmin } from '../../lib/supabase';
import { fmtLong } from '../../lib/format';

// §3.5: bookings in a date range as CSV for the accountant. Admin-gated by
// middleware (path starts with /admin).
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const cell = (v: unknown) => {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

export const GET: APIRoute = async ({ url }) => {
  const from = url.searchParams.get('from') ?? '';
  const to = url.searchParams.get('to') ?? '';
  if (!DATE.test(from) || !DATE.test(to)) return new Response('from & to (YYYY-MM-DD) required', { status: 400 });

  const db = createSupabaseAdmin();
  const { data: rows } = await db
    .from('bookings')
    .select(
      'start_at, price_cents, status, payment_status, coach:coach_id ( name ), client:client_id ( name, email ), variant:session_variant_id ( name, session_types ( name ) )',
    )
    .gte('start_at', `${from}T00:00:00Z`)
    .lt('start_at', `${to}T23:59:59Z`)
    .order('start_at');

  const header = ['date', 'client', 'email', 'coach', 'session', 'option', 'price', 'status', 'payment'];
  const lines = [header.join(',')];
  for (const b of (rows ?? []) as any[]) {
    lines.push(
      [
        fmtLong(b.start_at),
        b.client?.name ?? '',
        b.client?.email ?? '',
        b.coach?.name ?? '',
        b.variant?.session_types?.name ?? '',
        b.variant?.name ?? '',
        (b.price_cents ?? 0) / 100,
        b.status,
        b.payment_status,
      ]
        .map(cell)
        .join(','),
    );
  }

  return new Response('﻿' + lines.join('\r\n') + '\r\n', {
    headers: {
      'content-type': 'text/csv; charset=utf-8',
      'content-disposition': `attachment; filename="technicourt-${from}_${to}.csv"`,
    },
  });
};
