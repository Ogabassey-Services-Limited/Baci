import {
  createClient as createSupabaseClient,
  type SupabaseClient,
} from '@supabase/supabase-js';
import { getSupabaseServiceRoleKey, getSupabaseUrl } from '@/env';
import type { Database } from '@/types/supabase';

/**
 * Creates a Supabase service-role client for trusted server-only admin work.
 *
 * This bypasses RLS and must never be imported by client-side code or used for
 * user-facing operations that should respect merchant/customer authorization.
 */
export function createClient(
  sentinel: 'event-pipeline'
): SupabaseClient<Database>;
export function createClient(): SupabaseClient;
export function createClient(sentinel?: 'event-pipeline') {
  const url = getSupabaseUrl();
  const key = getSupabaseServiceRoleKey();

  if (!url || !key) {
    throw new Error(
      'Supabase configuration is missing. Please check your environment variables.'
    );
  }

  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  };
  return sentinel === 'event-pipeline'
    ? createSupabaseClient<Database>(url, key, options)
    : createSupabaseClient(url, key, options);
}

export const createAdminClient = createClient;
