import { createClient, type SupabaseClient } from '@supabase/supabase-js';

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
      fetch: (requestUrl, requestOptions = {}) => {
        const timeoutSignal = AbortSignal.timeout(options.timeoutMs ?? 10000);
        const signal = options.signal
          ? AbortSignal.any([
              ...(requestOptions.signal ? [requestOptions.signal] : []),
              options.signal,
              timeoutSignal,
            ])
          : requestOptions.signal
            ? AbortSignal.any([requestOptions.signal, timeoutSignal])
            : timeoutSignal;

        return fetch(requestUrl, {
          ...requestOptions,
          signal,
        });
      },
    },
  });
}
