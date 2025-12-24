import { createClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/env';

/**
 * Creates a Supabase client with service role key for admin operations.
 * This client bypasses RLS policies and should only be used in:
 * - Webhook handlers (no user context)
 * - Background jobs
 * - Admin operations that require RLS bypass
 *
 * WARNING: Never expose this client to the frontend!
 */
export function createServiceClient() {
  const url = getSupabaseUrl();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url) {
    throw new Error(
      'Supabase URL is missing. Please check your environment variables.'
    );
  }

  if (!serviceRoleKey) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY is missing. This is required for webhook handlers.'
    );
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
