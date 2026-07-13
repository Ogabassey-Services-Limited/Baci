/**
 * Supabase Client for Admin App
 */

import { createClient, processLock } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { registerAuthRefreshLifecycle } from './auth/auth-refresh-lifecycle';
import {
  authSessionStorage,
  getDefaultSupabaseAuthStorageKey,
} from './auth/auth-session-storage';

type ExpoExtraConfig = {
  supabaseAnonKey?: string;
  supabasePublishableKey?: string;
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
const supabasePublishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
  expoExtra.supabasePublishableKey ||
  '';
const legacySupabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || expoExtra.supabaseAnonKey || '';
const supabaseClientKey = supabasePublishableKey || legacySupabaseAnonKey;
const isUsingLegacyAnonKey = !supabasePublishableKey && !!legacySupabaseAnonKey;

function getValidSupabaseUrl(url: string): string {
  try {
    return url && new URL(url) ? url : '';
  } catch {
    return '';
  }
}

const validSupabaseUrl = getValidSupabaseUrl(supabaseUrl);
const hasSupabaseCredentials = Boolean(validSupabaseUrl && supabaseClientKey);

if (!hasSupabaseCredentials) {
  console.error(
    '[Supabase] CRITICAL: Supabase URL or publishable key is missing from environment variables.'
  );
  console.error(
    '[Supabase] Please ensure EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY are set in your build environment.'
  );
}

if (isUsingLegacyAnonKey) {
  console.warn(
    '[Supabase] Using legacy anon key fallback; migrate mobile-admin builds to EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY before end of 2026.'
  );
}

export const supabaseAuthStorageKey = validSupabaseUrl
  ? getDefaultSupabaseAuthStorageKey(validSupabaseUrl)
  : '';

const isServerRuntime = typeof window === 'undefined';

const authOptions = isServerRuntime
  ? {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    }
  : {
      storage: authSessionStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
      lock: processLock,
    };

function createMissingCredentialsClient() {
  return new Proxy(
    {},
    {
      get() {
        throw new Error(
          '[Supabase] Client accessed without EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY.'
        );
      },
    }
  ) as ReturnType<typeof createClient>;
}

const supabaseClient = hasSupabaseCredentials
  ? createClient(validSupabaseUrl, supabaseClientKey, {
      auth: authOptions,
    })
  : createMissingCredentialsClient();

if (hasSupabaseCredentials && !isServerRuntime) {
  registerAuthRefreshLifecycle(supabaseClient.auth);
}

export const supabase = supabaseClient;
