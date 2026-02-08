import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

/**
 * Cached stateless anon Supabase client.
 * Suitable for public/unauthenticated endpoints that don't need cookie-based sessions.
 * Reused across requests since it has no session state.
 * Respects RLS policies — NOT a service role client.
 */
let _anonClient: SupabaseClient | null = null;

export function createAnonClient(): SupabaseClient {
  if (!_anonClient) {
    _anonClient = createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _anonClient;
}
