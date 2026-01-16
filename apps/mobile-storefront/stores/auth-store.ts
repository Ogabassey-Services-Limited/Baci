/**
 * Customer Auth Store using Zustand
 * Manages customer authentication state for the storefront mobile app
 */

import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { supabase } from '../lib/supabase';

// Get merchant slug from app config
const MERCHANT_SLUG = Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';

interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  avatar_url?: string;
  loyalty_points?: number;
  loyalty_tier?: string;
}

interface AuthState {
  // State
  user: User | null;
  session: Session | null;
  customer: Customer | null;
  merchantId: string | null;
  isLoading: boolean;
  isInitialized: boolean;
  error: string | null;

  // Actions
  initialize: () => Promise<void>;
  signInWithOtp: (
    email: string
  ) => Promise<{ success: boolean; error?: string }>;
  verifyOtp: (
    email: string,
    token: string
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  refreshSession: () => Promise<void>;
  updateProfile: (
    data: Partial<Customer>
  ) => Promise<{ success: boolean; error?: string }>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  // Initial state
  user: null,
  session: null,
  customer: null,
  merchantId: null,
  isLoading: true,
  isInitialized: false,
  error: null,

  // Initialize auth state
  initialize: async () => {
    try {
      set({ isLoading: true, error: null });

      // First, get the merchant ID for this store
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', MERCHANT_SLUG)
        .single();

      if (merchantError || !merchant) {
        // Merchant not found - app can still work in guest mode
        console.warn(
          `Store "${MERCHANT_SLUG}" not found in database. Running in guest mode.`
        );
        set({
          merchantId: null,
          isLoading: false,
          isInitialized: true,
        });
        return;
      }

      set({ merchantId: merchant.id });

      // Get current session
      const {
        data: { session },
        error: sessionError,
      } = await supabase.auth.getSession();

      if (sessionError) {
        throw sessionError;
      }

      if (session?.user) {
        // Fetch customer data for this merchant
        const { data: customer } = await supabase
          .from('customers')
          .select(
            'id, email, first_name, last_name, phone, avatar_url, loyalty_points, loyalty_tier'
          )
          .eq('merchant_id', merchant.id)
          .eq('email', session.user.email)
          .single();

        set({
          user: session.user,
          session,
          customer: customer || null,
          isLoading: false,
          isInitialized: true,
        });
      } else {
        set({
          user: null,
          session: null,
          customer: null,
          isLoading: false,
          isInitialized: true,
        });
      }

      // Listen for auth changes
      supabase.auth.onAuthStateChange(async (event, session) => {
        console.log('Auth state changed:', event);
        const { merchantId } = get();

        if (event === 'SIGNED_IN' && session?.user && merchantId) {
          // Fetch or create customer record
          let { data: customer } = await supabase
            .from('customers')
            .select(
              'id, email, first_name, last_name, phone, avatar_url, loyalty_points, loyalty_tier'
            )
            .eq('merchant_id', merchantId)
            .eq('email', session.user.email)
            .single();

          // Create customer if doesn't exist
          if (!customer && session.user.email) {
            const { data: newCustomer } = await supabase
              .from('customers')
              .insert({
                merchant_id: merchantId,
                email: session.user.email,
                first_name:
                  session.user.user_metadata?.full_name?.split(' ')[0] || '',
                last_name:
                  session.user.user_metadata?.full_name
                    ?.split(' ')
                    .slice(1)
                    .join(' ') || '',
                avatar_url: session.user.user_metadata?.avatar_url,
                source: 'mobile_app',
              })
              .select(
                'id, email, first_name, last_name, phone, avatar_url, loyalty_points, loyalty_tier'
              )
              .single();

            customer = newCustomer;
          }

          set({
            user: session.user,
            session,
            customer: customer || null,
          });
        } else if (event === 'SIGNED_OUT') {
          set({
            user: null,
            session: null,
            customer: null,
          });
        } else if (event === 'TOKEN_REFRESHED' && session) {
          set({ session });
        }
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
        isInitialized: true,
      });
    }
  },

  // Sign in with OTP (passwordless)
  signInWithOtp: async (email: string) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: true, // Allow new customers to sign up
        },
      });

      if (error) {
        set({ error: error.message, isLoading: false });
        return { success: false, error: error.message };
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to send OTP';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Verify OTP
  verifyOtp: async (email: string, token: string) => {
    try {
      set({ isLoading: true, error: null });

      const { data, error } = await supabase.auth.verifyOtp({
        email,
        token,
        type: 'email',
      });

      if (error) {
        set({ error: error.message, isLoading: false });
        return { success: false, error: error.message };
      }

      // Customer record will be created/fetched in the auth state change listener
      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to verify OTP';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Sign in with Google (for future implementation)
  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: 'ogabassey://auth/callback',
        },
      });

      if (error) {
        set({ error: error.message, isLoading: false });
        return { success: false, error: error.message };
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to sign in with Google';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      set({ isLoading: true });
      await supabase.auth.signOut();
      set({
        user: null,
        session: null,
        customer: null,
        isLoading: false,
      });
    } catch (error) {
      console.error('Sign out error:', error);
      set({ isLoading: false });
    }
  },

  // Refresh session
  refreshSession: async () => {
    try {
      const {
        data: { session },
        error,
      } = await supabase.auth.refreshSession();

      if (error) {
        console.error('Session refresh error:', error);
        return;
      }

      if (session) {
        set({ session });
      }
    } catch (error) {
      console.error('Session refresh error:', error);
    }
  },

  // Update customer profile
  updateProfile: async (data: Partial<Customer>) => {
    try {
      const { customer, merchantId } = get();

      if (!customer || !merchantId) {
        return { success: false, error: 'Not logged in' };
      }

      const { data: updated, error } = await supabase
        .from('customers')
        .update({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
          avatar_url: data.avatar_url,
        })
        .eq('id', customer.id)
        .eq('merchant_id', merchantId)
        .select(
          'id, email, first_name, last_name, phone, avatar_url, loyalty_points, loyalty_tier'
        )
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      set({ customer: updated });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update profile';
      return { success: false, error: message };
    }
  },

  // Clear error
  clearError: () => {
    set({ error: null });
  },
}));
