import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseAnonKey, getSupabaseUrl } from '@/env';

/**
 * Cached stateless anon Supabase client.
 * Suitable for public/unauthenticated endpoints that don't need cookie-based sessions.
 * Reused across requests since it has no session state.
 * Respects RLS policies — NOT a service role client.
 */
let _anonClient: SupabaseClient | null = null;

function getPublicSupabaseCredentials() {
  const url = getSupabaseUrl();
  const key = getSupabaseAnonKey();

  if (!url || !key) {
    throw new Error('Supabase configuration is missing');
  }

  return { key, url };
}

export function createAnonClient(): SupabaseClient {
  if (!_anonClient) {
    const { key, url } = getPublicSupabaseCredentials();

    _anonClient = createClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
  }
  return _anonClient;
}

export function createPublicClient(options: {
  clientInfo: string;
  timeoutMs?: number;
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
