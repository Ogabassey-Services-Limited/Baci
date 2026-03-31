/**
 * Supabase Client for React Native
 * Uses expo-secure-store for secure token persistence
 *
 * 2026 Best Practices:
 * - SecureStore for native platforms (iOS/Android)
 * - sessionStorage for web (less persistent than localStorage, clears on tab close)
 * - Network connectivity checks before edge function calls
 */

import NetInfo from '@react-native-community/netinfo';
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

import type {
  CalculateOrderInputType,
  CalculateOrderOutputType,
  CalculateVTUInputType,
  CalculateVTUOutputType,
  RedeemLoyaltyInputType,
  RedeemLoyaltyOutputType,
} from './validation';

/** Default timeout for edge function calls (30 seconds) */
const EDGE_FUNCTION_TIMEOUT = 30000;

/**
 * Check network connectivity before edge function calls
 * 2026 Best Practice: Always verify network before critical operations
 */
async function checkNetwork(): Promise<boolean> {
  const state = await NetInfo.fetch();
  return state.isConnected === true && state.isInternetReachable !== false;
}

/**
 * Custom error class for commerce operations
 * 2026 Best Practice: Typed errors for better error handling
 */
export class CommerceError extends Error {
  code: string;

  constructor(message: string, code: string) {
    super(message);
    this.name = 'CommerceError';
    this.code = code;
  }
}

/**
 * Call the central commerce brain (Supabase Edge Function)
 * Centralizes math for Parity between Web & App
 * Includes analytics instrumentation for tracking
 *
 * 2026 Best Practices:
 * - Function overloads for type-safe API calls
 * - Network connectivity check before edge function calls
 * - Typed error handling
 */
export async function calculateCommerce(
  action: 'calculate_order',
  data: CalculateOrderInputType
): Promise<CalculateOrderOutputType>;
export async function calculateCommerce(
  action: 'calculate_vtu',
  data: CalculateVTUInputType
): Promise<CalculateVTUOutputType>;
export async function calculateCommerce(
  action: 'redeem_loyalty',
  data: RedeemLoyaltyInputType
): Promise<RedeemLoyaltyOutputType>;
export async function calculateCommerce(
  action: 'calculate_vtu' | 'calculate_order' | 'redeem_loyalty',
  data: CalculateOrderInputType | CalculateVTUInputType | RedeemLoyaltyInputType
): Promise<
  CalculateOrderOutputType | CalculateVTUOutputType | RedeemLoyaltyOutputType
> {
  const startTime = Date.now();

  // 2026 Best Practice: Check network before edge function calls
  const isOnline = await checkNetwork();
  if (!isOnline) {
    throw new CommerceError(
      'No internet connection. Please check your network and try again.',
      'NETWORK_ERROR'
    );
  }

  try {
    // 2026 Best Practice: Timeout for edge function calls
    // Prevents requests from hanging indefinitely on poor connections
    // supabase.functions.invoke() does not accept an AbortSignal,
    // so we use Promise.race to enforce the timeout.
    let result: unknown;
    let error: unknown;

    try {
      const invokePromise = supabase.functions.invoke('calculate-commerce', {
        body: { action, data },
      });

      let timeoutId: ReturnType<typeof setTimeout>;
      const timeoutPromise = new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(() => {
          reject(
            new CommerceError(
              'Request timed out. Please check your connection and try again.',
              'TIMEOUT_ERROR'
            )
          );
        }, EDGE_FUNCTION_TIMEOUT);
      });

      try {
        const response = await Promise.race([invokePromise, timeoutPromise]);
        clearTimeout(timeoutId!);
        result = response.data;
        error = response.error;
      } catch (e) {
        clearTimeout(timeoutId!);
        error = e;
      }
    } catch (e) {
      error = e;
    }

    if (error) {
      log.error(`Commerce Brain Error [${action}]:`, error);

      // Track commerce brain failure with safe dynamic import
      try {
        const { trackError } = await import('@/services/analytics');
        const errorMessage =
          (error as { message?: string })?.message || 'Unknown error';
        trackError('commerce_brain_error', errorMessage, {
          action,
          duration_ms: Date.now() - startTime,
        });
      } catch (trackErr) {
        log.warn('Failed to track error:', trackErr);
      }

      if (error instanceof Error) throw error;
      throw new CommerceError(
        (error as { message?: string })?.message ||
        'Commerce calculation failed',
        'COMMERCE_BRAIN_ERROR'
      );
    }

    // Track successful commerce brain call
    try {
      const { trackEvent } = await import('@/services/analytics');
      trackEvent('commerce_brain_called', {
        action,
        success: true,
        duration_ms: Date.now() - startTime,
      });
    } catch (trackErr) {
      log.warn('Failed to track event:', trackErr);
    }

    // Type assertion needed: Supabase edge function returns untyped JSON.
    // The function overloads above guarantee the correct return type per action.
    return result as
      | CalculateOrderOutputType
      | CalculateVTUOutputType
      | RedeemLoyaltyOutputType;
  } catch (error) {
    if (error instanceof CommerceError) throw error;

    // Track external failures (network, etc)
    try {
      const { trackError } = await import('@/services/analytics');
      trackError(
        'commerce_brain_error',
        error instanceof Error ? error.message : 'Unknown error',
        {
          action,
          duration_ms: Date.now() - startTime,
        }
      );
    } catch (trackErr) {
      log.warn('Failed to track catch error:', trackErr);
    }

    if (error instanceof Error) throw error;
    throw new CommerceError('Unknown commerce error', 'UNKNOWN_ERROR');
  }
}
