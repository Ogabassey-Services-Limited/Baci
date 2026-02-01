/**
 * Customer Auth Store using Zustand
 * Manages customer authentication state for the storefront mobile app
 *
 * 2026 Best Practices:
 * - Cart sync after login (preserves guest cart items)
 * - Auth subscription cleanup
 * - Typed error handling
 */

import type { Session, User } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import { create } from 'zustand';
import { createLogger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { useCartStore } from './cart-store';
import { CustomerRowSchema, MerchantRowSchema } from '../lib/validation';

const log = createLogger('AuthStore');

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
  cleanup: () => void; // 2026 Critical Fix: Cleanup auth subscription
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
  // Internal: store auth subscription for cleanup (2026 Best Practice)
  _authSubscription: null as {
    subscription: { unsubscribe: () => void };
  } | null,
  // 2026 Critical Fix: Prevent multiple concurrent initialize calls
  _initializationInProgress: false as boolean,
  // Store expected redirect URL for OAuth validation
  _expectedRedirectUrl: null as string | null,

  // Initialize auth state
  initialize: async () => {
    // 2026 Critical Fix: Prevent race conditions from multiple initialize() calls
    const state = get() as AuthState & { _initializationInProgress: boolean };
    if (state._initializationInProgress || state.isInitialized) {
      log.debug('Initialize already in progress or completed, skipping');
      return;
    }

    set({ _initializationInProgress: true } as Partial<AuthState>);

    try {
      set({ isLoading: true, error: null });

      // First, get the merchant ID for this store
      const { data: merchant, error: merchantError } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', MERCHANT_SLUG)
        .single();

      // 2026 Best Practice: Validate merchant data
      const merchantValidation = MerchantRowSchema.safeParse(merchant);

      if (merchantError || !merchantValidation.success) {
        // Merchant not found - app can still work in guest mode
        log.warn(
          `Store "${MERCHANT_SLUG}" not found in database. Running in guest mode.`
        );
        set({
          merchantId: null,
          isLoading: false,
          isInitialized: true,
        });
        return;
      }

      set({ merchantId: merchantValidation.data.id });

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
        const { data: customerData } = await supabase
          .from('customers')
          .select(
            'id, email, first_name, last_name, phone, avatar_url, loyalty_points, loyalty_tier'
          )
          .eq('merchant_id', merchantValidation.data.id)
          .eq('email', session.user.email)
          .single();

        // 2026 Best Practice: Validate customer data
        const customerValidation = CustomerRowSchema.safeParse(customerData);
        const customer = customerValidation.success
          ? {
              id: customerValidation.data.id,
              email: customerValidation.data.email,
              first_name: customerValidation.data.first_name ?? undefined,
              last_name: customerValidation.data.last_name ?? undefined,
              phone: customerValidation.data.phone ?? undefined,
              avatar_url: customerValidation.data.avatar_url ?? undefined,
              loyalty_points:
                customerValidation.data.loyalty_points ?? undefined,
              loyalty_tier: customerValidation.data.loyalty_tier ?? undefined,
            }
          : null;

        set({
          user: session.user,
          session,
          customer,
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

      // Listen for auth changes - store subscription for cleanup (2026 Best Practice)
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          log.debug('Auth state changed:', event);
          const { merchantId } = get();

          // 2026 Critical Fix: Wrap async auth listener operations in try-catch
          // to prevent unhandled promise rejections and race conditions
          try {
            if (event === 'SIGNED_IN' && session?.user && merchantId) {
              // Fetch or create customer record
              let { data: customerData } = await supabase
                .from('customers')
                .select(
                  'id, email, first_name, last_name, phone, avatar_url, loyalty_points, loyalty_tier'
                )
                .eq('merchant_id', merchantId)
                .eq('email', session.user.email)
                .single();

              // Create customer if doesn't exist
              if (!customerData && session.user.email) {
                const { data: newCustomer } = await supabase
                  .from('customers')
                  .insert({
                    merchant_id: merchantId,
                    email: session.user.email,
                    first_name:
                      session.user.user_metadata?.full_name?.split(' ')[0] ||
                      '',
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

                customerData = newCustomer;
              }

              // 2026 Best Practice: Validate customer data from auth listener
              const authCustomerValidation =
                CustomerRowSchema.safeParse(customerData);
              const validatedCustomer = authCustomerValidation.success
                ? {
                    id: authCustomerValidation.data.id,
                    email: authCustomerValidation.data.email,
                    first_name:
                      authCustomerValidation.data.first_name ?? undefined,
                    last_name:
                      authCustomerValidation.data.last_name ?? undefined,
                    phone: authCustomerValidation.data.phone ?? undefined,
                    avatar_url:
                      authCustomerValidation.data.avatar_url ?? undefined,
                    loyalty_points:
                      authCustomerValidation.data.loyalty_points ?? undefined,
                    loyalty_tier:
                      authCustomerValidation.data.loyalty_tier ?? undefined,
                  }
                : null;

              // 2026 Best Practice: Sync guest cart after login
              // The local cart persists through login - no server sync needed
              // Items added as guest are automatically kept in the user's session
              // This prevents cart data loss during authentication flow
              const guestCartItems = useCartStore.getState().items;
              if (guestCartItems.length > 0) {
                log.info(
                  `Cart sync: ${guestCartItems.length} items preserved after login`
                );
                // Cart items remain in local storage, linked to this session
                // Future enhancement: sync cart to server for cross-device access
              }

              set({
                user: session.user,
                session,
                customer: validatedCustomer,
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
          } catch (authListenerError) {
            log.error('Error in auth state change handler:', authListenerError);
            // Don't crash the app - just log the error
            // User can still retry operations manually
          }
        }
      );

      // Store subscription reference for cleanup (2026 Critical Fix)
      set({
        _authSubscription: authListener,
        _initializationInProgress: false,
      } as Partial<AuthState>);
    } catch (error) {
      log.error('Auth initialization error:', error);
      set({
        error: error instanceof Error ? error.message : 'Failed to initialize',
        isLoading: false,
        isInitialized: true,
        _initializationInProgress: false,
      } as Partial<AuthState>);
    }
  },

  // 2026 Critical Fix: Cleanup auth subscription to prevent memory leaks
  cleanup: () => {
    const state = get() as AuthState & {
      _authSubscription: { subscription: { unsubscribe: () => void } } | null;
    };
    if (state._authSubscription?.subscription) {
      log.debug('Cleaning up auth subscription');
      state._authSubscription.subscription.unsubscribe();
      set({ _authSubscription: null } as Partial<AuthState>);
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

      const { error } = await supabase.auth.verifyOtp({
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

  // Sign in with Google OAuth
  // 2026 Best Practice: Use expo-web-browser for OAuth in React Native
  signInWithGoogle: async () => {
    try {
      set({ isLoading: true, error: null });

      // Dynamically import expo-web-browser to avoid issues on web
      const WebBrowser = await import('expo-web-browser');
      const Linking = await import('expo-linking');

      // Create the redirect URL for the app
      const redirectUrl = Linking.createURL('auth/callback');

      // Get the OAuth URL from Supabase without auto-redirect
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true, // Important: We'll handle the browser ourselves
        },
      });

      if (error || !data.url) {
        set({
          error: error?.message || 'Failed to get OAuth URL',
          isLoading: false,
        });
        return {
          success: false,
          error: error?.message || 'Failed to get OAuth URL',
        };
      }

      // Open the OAuth URL in an in-app browser
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        { showInRecents: true }
      );

      if (result.type === 'success' && result.url) {
        // 2026 Critical Fix: Validate OAuth redirect URL origin before extracting tokens
        const resultUrl = new URL(result.url);
        const expectedUrl = new URL(redirectUrl);

        // Validate URL scheme and host match expected redirect
        // This prevents open redirect attacks and token injection
        if (
          resultUrl.protocol !== expectedUrl.protocol ||
          resultUrl.host !== expectedUrl.host ||
          !resultUrl.pathname.startsWith(expectedUrl.pathname)
        ) {
          log.warn('OAuth redirect URL mismatch:', {
            expected: redirectUrl,
            received: result.url.substring(0, 100), // Log only first 100 chars for security
          });
          set({ error: 'Invalid OAuth redirect', isLoading: false });
          return { success: false, error: 'Invalid OAuth redirect' };
        }

        // Extract the access token and refresh token from the URL
        const params = new URLSearchParams(resultUrl.hash.substring(1)); // Remove # prefix
        const accessToken = params.get('access_token');
        const refreshToken = params.get('refresh_token');

        if (accessToken && refreshToken) {
          // Set the session manually
          const { error: sessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (sessionError) {
            set({ error: sessionError.message, isLoading: false });
            return { success: false, error: sessionError.message };
          }

          set({ isLoading: false });
          return { success: true };
        }

        // Check for error in URL params
        const errorParam = params.get('error');
        const errorDescription = params.get('error_description');
        if (errorParam) {
          set({ error: errorDescription || errorParam, isLoading: false });
          return { success: false, error: errorDescription || errorParam };
        }
      }

      // User cancelled or dismissed the browser
      if (result.type === 'cancel' || result.type === 'dismiss') {
        set({ isLoading: false });
        return { success: false, error: 'Sign in was cancelled' };
      }

      set({ isLoading: false });
      return { success: false, error: 'OAuth flow failed' };
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

      // 2026 Critical Fix: Cleanup auth subscription before sign out
      get().cleanup();

      await supabase.auth.signOut();
      // Clear cart on logout to prevent cart data leakage between users
      useCartStore.getState().clearCart();
      set({
        user: null,
        session: null,
        customer: null,
        isLoading: false,
        isInitialized: false, // Allow re-initialization after sign out
      });
    } catch (error) {
      log.error('Sign out error:', error);
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
        log.error('Session refresh error:', error);
        return;
      }

      if (session) {
        set({ session });
      }
    } catch (error) {
      log.error('Session refresh error:', error);
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
