/**
 * Supabase Client for Admin App
 */

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { storage } from './storage';

type ExpoExtraConfig = {
  supabaseAnonKey?: string;
  supabaseUrl?: string;
};

function getExpoExtraConfig(): ExpoExtraConfig {
  const expoExtra = Constants.expoConfig?.extra;

  if (!expoExtra || typeof expoExtra !== 'object') {
    return {};
  }

  return expoExtra as ExpoExtraConfig;
}

const expoExtra = getExpoExtraConfig();
const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL || expoExtra.supabaseUrl || '';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || expoExtra.supabaseAnonKey || '';

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '[Supabase] CRITICAL: Supabase URL or Anon Key is missing from environment variables.'
  );
  console.error(
    '[Supabase] Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY are set in your build environment.'
  );
}

const mmkvStorage = {
  getItem: (key: string) => storage.getString(key) ?? null,
  setItem: (key: string, value: string) => storage.set(key, value),
  removeItem: (key: string) => {
    storage.remove(key);
  },
};

function createMissingCredentialsClient() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          '[Supabase] Client accessed without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.'
        );
      },
    }
  ) as ReturnType<typeof createClient>;
}

export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: mmkvStorage,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false,
        },
      })
    : createMissingCredentialsClient();
