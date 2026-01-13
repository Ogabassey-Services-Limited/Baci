/**
 * Supabase Client for React Native
 * Uses expo-secure-store for secure token persistence
 */

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

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
 * Falls back to in-memory storage for web platform
 */
const ExpoSecureStoreAdapter = {
  getItem: async (key: string): Promise<string | null> => {
    if (Platform.OS === 'web') {
      // Use localStorage for web
      if (typeof window !== 'undefined') {
        return window.localStorage.getItem(key);
      }
      return null;
    }
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore getItem error:', error);
      return null;
    }
  },

  setItem: async (key: string, value: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, value);
      }
      return;
    }
    try {
      await SecureStore.setItemAsync(key, value);
    } catch (error) {
      console.error('SecureStore setItem error:', error);
    }
  },

  removeItem: async (key: string): Promise<void> => {
    if (Platform.OS === 'web') {
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(key);
      }
      return;
    }
    try {
      await SecureStore.deleteItemAsync(key);
    } catch (error) {
      console.error('SecureStore removeItem error:', error);
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
    console.error('Error getting session:', error);
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
    console.error('Error getting user:', error);
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
    console.error('Error signing out:', error);
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

/**
 * Call the central commerce brain (Supabase Edge Function)
 * Centralizes math for Parity between Web & App
 * Includes analytics instrumentation for tracking
 *
 * 2025 Best Practice: Function overloads for type-safe API calls
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

  try {
    const { data: result, error } = await supabase.functions.invoke(
      'calculate-commerce',
      {
        body: { action, data },
      }
    );

    if (error) {
      console.error(`Commerce Brain Error [${action}]:`, error);

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
