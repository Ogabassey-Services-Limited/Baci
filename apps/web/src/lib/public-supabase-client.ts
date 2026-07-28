import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { createStorefrontPublicReadFetch } from './storefront-public-read-fetch';

/** Creates the anonymous, cookie-free client used by public cached reads. */
export function getPublicSupabaseClient(options?: { timeoutMs?: number }) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  const publicFetch = createStorefrontPublicReadFetch(options?.timeoutMs);

  return createClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      fetch: publicFetch,
      headers: {
        'X-Client-Info': 'baci-web-cached',
      },
    },
  });
}
