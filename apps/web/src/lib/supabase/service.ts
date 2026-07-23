import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseUrl } from '@/env';
import type { Database } from '@/types/supabase';

const serviceRoleClientBrand: unique symbol = Symbol(
  'baci.event-pipeline.service-role-client'
);
const serviceRoleBrandValue: true = true;

export type ServiceRoleClient = SupabaseClient<Database> & {
  readonly [serviceRoleClientBrand]: true;
};

/**
 * Creates a Supabase client with service role key for admin operations.
 * This client bypasses RLS policies and should only be used in:
 * - Webhook handlers (no user context)
 * - Background jobs
 * - Admin operations that require RLS bypass
 *
 * WARNING: Never expose this client to the frontend!
 */
export function createServiceClient(
  sentinel: 'event-pipeline'
): ServiceRoleClient;
export function createServiceClient(): SupabaseClient;
export function createServiceClient(sentinel?: 'event-pipeline') {
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

  const options = {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: { fetch: globalThis.fetch },
  };
  if (sentinel === 'event-pipeline') {
    return Object.assign(createClient<Database>(url, serviceRoleKey, options), {
      [serviceRoleClientBrand]: serviceRoleBrandValue,
    });
  }
  return createClient(url, serviceRoleKey, options);
}
