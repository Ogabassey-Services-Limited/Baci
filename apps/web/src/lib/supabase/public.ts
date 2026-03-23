import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

export function createPublicClient(options: {
  clientInfo: string;
  timeoutMs?: number;
}): SupabaseClient {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

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
        const signal = requestOptions.signal
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
