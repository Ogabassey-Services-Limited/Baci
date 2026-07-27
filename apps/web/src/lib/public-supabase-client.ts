import { createClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { createTimeoutComposedFetch } from '@/lib/supabase/compose-fetch-signal';
import { createStorefrontBuildReadFetch } from './storefront-build-read-fetch';

const CACHED_CLIENT_DEFAULT_TIMEOUT_MS = 10_000;

/** Creates the anonymous, cookie-free client used by public cached reads. */
export function getPublicSupabaseClient(options?: { timeoutMs?: number }) {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  const timedFetch = createTimeoutComposedFetch(
    options?.timeoutMs ?? CACHED_CLIENT_DEFAULT_TIMEOUT_MS
  );
  const publicFetch =
    process.env.BACI_STOREFRONT_BUILD_READS === 'serialized'
      ? createStorefrontBuildReadFetch(timedFetch)
      : timedFetch;

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
