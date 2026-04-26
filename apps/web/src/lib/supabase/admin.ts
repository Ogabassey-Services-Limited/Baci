import { createClient } from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/env';

/**
 * Creates a Supabase service-role client for trusted server-only admin work.
 *
 * This bypasses RLS and must never be imported by client-side code or used for
 * user-facing operations that should respect merchant/customer authorization.
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error(
      'Supabase configuration is missing. Please check your environment variables.'
    );
  }

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
