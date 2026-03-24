import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

export { createPublicClient } from '@/lib/supabase/public';

/**
 * Cached stateless anon Supabase client.
 * Suitable for public/unauthenticated endpoints that don't need cookie-based sessions.
 * Reused across requests since it has no session state.
 * Respects RLS policies — NOT a service role client.
 */
let _anonClient: SupabaseClient | null = null;

function getPublicSupabaseCredentials() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

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
