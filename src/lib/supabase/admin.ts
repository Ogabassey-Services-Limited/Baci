import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

/**
 * Creates a Supabase client for server-side operations that don't require user authentication.
 * This uses the anon key but without cookie handling, suitable for:
 * - Sitemap generation
 * - Public data fetching
 * - Background jobs
 *
 * Note: This client respects RLS policies. For operations requiring bypass of RLS,
 * use the service_role key (not included here for security).
 */
export function createAdminClient() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

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
