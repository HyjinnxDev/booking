/// <reference types="astro/client" />

import type { SupabaseClient, User } from '@supabase/supabase-js';

type Role = 'admin' | 'coach' | 'client';

declare global {
  namespace App {
    interface Locals {
      supabase: SupabaseClient;
      user: User | null;
      profile: {
        id: string;
        role: Role;
        name: string;
        email: string;
        phone: string | null;
        active: boolean;
      } | null;
      /** Request is inside an embedded widget iframe — render without site chrome. */
      embed: boolean;
    }
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_SUPABASE_URL: string;
  readonly PUBLIC_SUPABASE_ANON_KEY: string;
  readonly PUBLIC_SITE_URL: string;
  readonly PUBLIC_BUSINESS_TZ: string;
}
interface ImportMeta {
  readonly env: ImportMetaEnv;
}

export {};
