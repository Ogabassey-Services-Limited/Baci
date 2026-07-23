import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export { createPublicClient } from '@/lib/supabase/public';

/**
 * Cached stateless anon Supabase client.
 * Suitable for public/unauthenticated endpoints that don't need cookie-based sessions.
 * Reused across requests since it has no session state.
 * Respects RLS policies — NOT a service role client.
 */
let _anonClient: SupabaseClient | null = null;

function getPublicSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Public Supabase configuration is missing');
  }

  return { key, url };
}

export function createAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const { key, url } = getPublicSupabaseCredentials();

    _anonClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _anonClient;
}
