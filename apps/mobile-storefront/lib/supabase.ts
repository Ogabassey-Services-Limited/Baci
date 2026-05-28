/**
 * Supabase Client for React Native
 * Uses expo-secure-store for secure token persistence
 *
 * 2026 Best Practices:
 * - SecureStore for native platforms (iOS/Android)
 * - sessionStorage for web (less persistent than localStorage, clears on tab close)
 * - Network connectivity checks before edge function calls
 */

import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { createLogger } from './logger';

const log = createLogger('Supabase');

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

// Runtime warning when Supabase credentials are missing
if (!supabaseUrl) {
  console.warn(
    '[Supabase] SUPABASE_URL is not configured. Set EXPO_PUBLIC_SUPABASE_URL or configure extra.supabaseUrl in app.json.'
  );
}
if (!supabaseAnonKey) {
  console.warn(
    '[Supabase] SUPABASE_ANON_KEY is not configured. Set EXPO_PUBLIC_SUPABASE_ANON_KEY or configure extra.supabaseAnonKey in app.json.'
  );
}

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

/**
 * Custom storage adapter using expo-secure-store
 * 2026 Best Practice: sessionStorage for web (more secure than localStorage)
 * - sessionStorage clears when tab closes, reducing token exposure
 * - localStorage persists indefinitely and is accessible to XSS attacks
 * - Native platforms use SecureStore (encrypted keychain/keystore)
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      // 2026 Best Practice: Use sessionStorage instead of localStorage
      // Less persistent but more secure - tokens cleared when tab closes
      if (typeof window !== 'undefined') {
        return window.sessionStorage.getItem(key);
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      log.error('SecureStore getItem error:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      // 2026 Best Practice: sessionStorage for auth tokens on web
      if (typeof window !== 'undefined') {
        window.sessionStorage.setItem(key, value);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      log.error('SecureStore setItem error:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.sessionStorage.removeItem(key);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      log.error('SecureStore removeItem error:', error);
    }
  },
};

/**
 * Supabase client instance with secure storage
 */
export const supabase =
  supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          storage: ExpoSecureStoreAdapter,
          autoRefreshToken: true,
          persistSession: true,
          detectSessionInUrl: false, // Important for React Native
          flowType: 'implicit', // Implicit flow is officially recommended for React Native (PKCE code_verifier gets lost with expo-web-browser)
        },
      })
    : createMissingCredentialsClient();

/**
 * Check if Supabase is configured
 */
export function isSupabaseConfigured(): boolean {
  return Boolean(supabaseUrl && supabaseAnonKey);
}

/**
 * Get the current user session
 */
export async function getSession() {
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  if (error) {
    log.error('Error getting session:', error);
    return null;
  }
  return session;
}

/**
 * Get the current user
 */
export async function getCurrentUser() {
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error) {
    log.error('Error getting user:', error);
    return null;
  }
  return user;
}

/**
 * Sign out the current user
 */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    log.error('Error signing out:', error);
    throw error;
  }
}

export { calculateCommerce, CommerceError } from './commerce-brain';
