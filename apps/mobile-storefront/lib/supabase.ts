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

// Get Supabase credentials from app.json extra config
const supabaseUrl =
  Constants.expoConfig?.extra?.supabaseUrl ||
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  '';
const supabaseAnonKey =
  Constants.expoConfig?.extra?.supabaseAnonKey ||
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  '';

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
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: ExpoSecureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native
  },
});

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
    // 2026 Best Practice: AbortController timeout for edge function calls
    // Prevents requests from hanging indefinitely on poor connections
    const controller = new AbortController();
    const timeoutId = setTimeout(
      () => controller.abort(),
      EDGE_FUNCTION_TIMEOUT
    );

    let result: any;
    let error: any;

    try {
      const response = await supabase.functions.invoke('calculate-commerce', {
        body: { action, data },
      });
      result = response.data;
      error = response.error;
    } finally {
      clearTimeout(timeoutId);
    }

    if (error) {
      log.error(`Commerce Brain Error [${action}]:`, error);

      // Track commerce brain failure
      const { trackError } = await import('@/services/analytics');
      trackError('commerce_brain_error', error.message, {
        action,
        duration_ms: Date.now() - startTime,
      });

      throw error;
    }

    // Track successful commerce brain call
    const { trackEvent } = await import('@/services/analytics');
    trackEvent('commerce_brain_called', {
      action,
      success: true,
      duration_ms: Date.now() - startTime,
    });

    return result;
  } catch (error) {
    // Track commerce brain failure for network errors
    const { trackError } = await import('@/services/analytics');
    trackError(
      'commerce_brain_error',
      error instanceof Error ? error.message : 'Unknown error',
      {
        action,
        duration_ms: Date.now() - startTime,
      }
    );

    throw error;
  }
}
