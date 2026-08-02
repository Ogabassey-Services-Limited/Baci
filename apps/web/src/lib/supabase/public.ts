import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createStorefrontPublicReadFetch } from '@/lib/storefront-public-read-fetch';

function getPublicSupabaseCredentials() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new Error('Public Supabase configuration is missing');
  }

  return { key, url };
}

export function createPublicClient(options: {
  clientInfo: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): SupabaseClient {
  const { key, url } = getPublicSupabaseCredentials();

  return createClient(url, key, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
    global: {
      headers: {
        'X-Client-Info': options.clientInfo,
      },
      fetch: (() => {
        const publicReadFetch = createStorefrontPublicReadFetch(
          options.timeoutMs
        );

        return (
          requestUrl: RequestInfo | URL,
          requestOptions: RequestInit = {}
        ) => {
          const signal = options.signal
            ? requestOptions.signal
              ? AbortSignal.any([requestOptions.signal, options.signal])
              : options.signal
            : requestOptions.signal;

          return publicReadFetch(
            requestUrl,
            signal ? { ...requestOptions, signal } : requestOptions
          );
        };
      })(),
    },
  });
}
