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
import { Alert } from 'react-native';
import { create } from 'zustand';
import {
  type DeleteAccountResult,
  getDeleteAccountErrorMessage,
  hasAppleProvider,
} from '../lib/account-deletion';
import { splitFullName } from '../lib/auth-helpers';
import { createLogger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { CustomerRowSchema, MerchantRowSchema } from '../lib/validation';
import { useCartStore } from './cart-store';

const log = createLogger('AuthStore');

// Get merchant slug from app config
const MERCHANT_SLUG = Constants.expoConfig?.extra?.merchantSlug || 'ogabassey';

export interface Customer {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  loyalty_points?: number;
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
  signInWithPassword: (
    email: string,
    password: string
  ) => Promise<{ success: boolean; error?: string }>;
  signInWithGoogle: () => Promise<{ success: boolean; error?: string }>;
  signInWithApple: () => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<DeleteAccountResult>;
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
        // BUG-3-011: Include Zod error details in log
        const errorDetails = merchantValidation.success
          ? 'Database error'
          : JSON.stringify(merchantValidation.error.flatten());
        log.warn(
          `Store "${MERCHANT_SLUG}" not found in database. Running in guest mode. Details: ${errorDetails}`
        );
        set({
          merchantId: null,
          isLoading: false,
          isInitialized: true,
          _initializationInProgress: false,
        } as Partial<AuthState>);
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

      // After getting session, validate JWT with server
      if (session) {
        const { error: userError } = await supabase.auth.getUser();
        if (userError) {
          // Session is invalid/expired — clear and return in guest mode
          log.warn('Session JWT validation failed:', userError.message);
          set({
            user: null,
            session: null,
            customer: null,
            isLoading: false,
            isInitialized: true,
            _initializationInProgress: false,
          } as Partial<AuthState>);
          return;
        }
      }

      if (session?.user) {
        // M25 fix: Guard against undefined email before using in query
        if (!session.user.email) {
          log.warn('Session user has no email, skipping customer fetch');
          set({
            user: session.user,
            session,
            customer: null,
            isLoading: false,
            isInitialized: true,
            _initializationInProgress: false,
          } as Partial<AuthState>);
          return;
        }

        // Fetch customer data for this merchant
        let { data: customerData } = await supabase
          .from('customers')
          .select('id, email, first_name, last_name, phone, loyalty_points')
          .eq('merchant_id', merchantValidation.data.id)
          .eq('email', session.user.email)
          .single();

        // Create customer record if it doesn't exist (mirrors auth listener logic)
        // This covers the case where a user returns with an active session but
        // no customer record — the SIGNED_IN event won't fire for existing sessions.
        if (!customerData && session.user.email) {
          const { firstName, lastName } = splitFullName(
            session.user.user_metadata?.full_name
          );

          const { data: newCustomer } = await supabase
            .from('customers')
            .insert({
              merchant_id: merchantValidation.data.id,
              email: session.user.email,
              first_name: firstName,
              last_name: lastName,
            })
            .select('id, email, first_name, last_name, phone, loyalty_points')
            .single();

          customerData = newCustomer;
        }

        // Backfill missing profile fields from OAuth provider on app init
        if (customerData && session.user.user_metadata) {
          const meta = session.user.user_metadata;
          const { firstName, lastName } = splitFullName(meta.full_name);
          const updates: Record<string, string> = {};

          if (!customerData.first_name && firstName)
            updates.first_name = firstName;
          if (!customerData.last_name && lastName) updates.last_name = lastName;

          if (Object.keys(updates).length > 0) {
            const { data: updated } = await supabase
              .from('customers')
              .update(updates)
              .eq('id', customerData.id)
              .eq('merchant_id', merchantValidation.data.id)
              .select('id, email, first_name, last_name, phone, loyalty_points')
              .single();

            if (updated) customerData = updated;
          }
        }

        // 2026 Best Practice: Validate customer data
        const customerValidation = CustomerRowSchema.safeParse(customerData);
        const customer = customerValidation.success
          ? {
              id: customerValidation.data.id,
              email: customerValidation.data.email,
              first_name: customerValidation.data.first_name ?? undefined,
              last_name: customerValidation.data.last_name ?? undefined,
              phone: customerValidation.data.phone ?? undefined,
              loyalty_points:
                customerValidation.data.loyalty_points ?? undefined,
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
            if (event === 'SIGNED_IN' && session?.user) {
              // Always set user + session immediately so login screen can dismiss
              set({ user: session.user, session });

              // M25 fix: Guard against undefined email before using in query
              if (!session.user.email || !merchantId) {
                log.warn(
                  'Auth listener: Skipping customer fetch —',
                  !session.user.email ? 'no email' : 'no merchantId'
                );
                set({ customer: null });
                return;
              }

              // Fetch or create customer record
              let { data: customerData } = await supabase
                .from('customers')
                .select(
                  'id, email, first_name, last_name, phone, loyalty_points'
                )
                .eq('merchant_id', merchantId)
                .eq('email', session.user.email)
                .single();

              // Create customer if doesn't exist
              if (!customerData && session.user.email) {
                // BUG-3-007: Validate full_name before splitting
                const { firstName, lastName } = splitFullName(
                  session.user.user_metadata?.full_name
                );

                const { data: newCustomer } = await supabase
                  .from('customers')
                  .insert({
                    merchant_id: merchantId,
                    email: session.user.email,
                    first_name: firstName,
                    last_name: lastName,
                  })
                  .select(
                    'id, email, first_name, last_name, phone, loyalty_points'
                  )
                  .single();

                customerData = newCustomer;
              } else if (customerData && session.user.user_metadata) {
                // Backfill missing profile fields from OAuth provider (e.g. Google name/avatar)
                const meta = session.user.user_metadata;
                const { firstName, lastName } = splitFullName(meta.full_name);
                const updates: Record<string, string> = {};

                if (!customerData.first_name && firstName)
                  updates.first_name = firstName;
                if (!customerData.last_name && lastName)
                  updates.last_name = lastName;

                if (Object.keys(updates).length > 0) {
                  const { data: updated } = await supabase
                    .from('customers')
                    .update(updates)
                    .eq('id', customerData.id)
                    .eq('merchant_id', merchantId)
                    .select(
                      'id, email, first_name, last_name, phone, loyalty_points'
                    )
                    .single();

                  if (updated) customerData = updated;
                }
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
                    loyalty_points:
                      authCustomerValidation.data.loyalty_points ?? undefined,
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

  // BUG-3-001: Sign in with email/password (CRITICAL)
  signInWithPassword: async (email: string, password: string) => {
    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
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
        error instanceof Error
          ? error.message
          : 'Failed to sign in with password';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Sign in with Google OAuth (Implicit flow — official Supabase React Native pattern)
  signInWithGoogle: async () => {
    // 2026 Best Practice: Prevent multiple concurrent sign-in requests
    const state = get();
    if (state.isLoading && state.isInitialized) {
      log.warn('Sign-in already in progress, skipping');
      return { success: false, error: 'Sign-in already in progress' };
    }

    try {
      set({ isLoading: true, error: null });

      const WebBrowser = await import('expo-web-browser');
      const { makeRedirectUri } = await import('expo-auth-session');
      const QueryParams = await import('expo-auth-session/build/QueryParams');

      // makeRedirectUri handles dev/prod/Expo Go variations automatically
      const redirectUrl = makeRedirectUri();

      log.debug('Generated OAuth redirect URL:', redirectUrl);

      // Implicit flow: Supabase returns tokens directly in the redirect URL
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
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

      log.debug('Opening Google OAuth URL');
      const result = await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectUrl,
        { showInRecents: true }
      );

      if (result.type === 'success' && result.url) {
        log.info('WebBrowser returned success URL');

        // Official Supabase pattern: extract tokens from redirect URL hash/params
        const { params, errorCode } = QueryParams.getQueryParams(result.url);

        if (errorCode) {
          log.error('OAuth error code returned:', errorCode);
          set({ isLoading: false });
          return { success: false, error: errorCode };
        }

        const { access_token, refresh_token } = params;

        if (!access_token) {
          log.warn(
            'No access_token in redirect URL. Params:',
            Object.keys(params)
          );
          set({ isLoading: false });
          return {
            success: false,
            error: 'No access token received from Google',
          };
        }

        log.info('Tokens received, setting session...');
        const { data: sessionData, error: sessionError } =
          await supabase.auth.setSession({
            access_token,
            refresh_token,
          });

        if (sessionError) {
          log.error('setSession failed:', sessionError);
          set({ isLoading: false });
          Alert.alert('Sign-In Error', sessionError.message);
          return { success: false, error: sessionError.message };
        }

        log.info('Session established for:', sessionData.user?.email);
        set({ isLoading: false });
        return { success: true };
      }

      set({ isLoading: false });

      if (result.type === 'cancel' || result.type === 'dismiss') {
        log.info(`Google flow ended with result: ${result.type}`);
        return { success: false, error: 'Sign-in cancelled' };
      }

      return { success: false, error: `Login failed: ${result.type}` };
    } catch (error) {
      log.error('Google sign-in error:', error);
      set({ isLoading: false });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Google sign-in failed',
      };
    }
  },

  // BUG-3-010: Robust implementation of Apple Sign-In (2026 Best Practice)
  signInWithApple: async () => {
    try {
      set({ isLoading: true, error: null });

      // Dynamically import to avoid crashes if package is not yet installed
      let AppleAuthentication;
      try {
        AppleAuthentication = await import('expo-apple-authentication');
      } catch (_e) {
        throw new Error(
          'expo-apple-authentication not installed. Please run "npx expo install expo-apple-authentication"'
        );
      }

      // Check if Apple Authentication is available
      const isAvailable = await AppleAuthentication.isAvailableAsync();
      if (!isAvailable) {
        throw new Error('Apple Authentication is not available on this device');
      }

      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) {
        throw new Error('Apple Sign-In failed: No identity token received');
      }

      // 2026 Best Practice: Apple only returns name and email on the VERY FIRST sign-in.
      // We must capture it here and ensure it's synced to the user metadata or customer record.
      const fullName = credential.fullName
        ? `${credential.fullName.givenName || ''} ${credential.fullName.familyName || ''}`.trim()
        : null;

      const { data, error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) {
        set({ error: error.message, isLoading: false });
        return { success: false, error: error.message };
      }

      // If we got a name, and it's a new user (or metadata is empty), update it
      if (fullName && data.user && !data.user.user_metadata?.full_name) {
        log.info('Updating user metadata with Apple name');
        await supabase.auth.updateUser({
          data: {
            full_name: fullName,
            // Apple doesn't provide avatar but we could set a placeholder
          },
        });
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      // 2026 Best Practice: Handle Apple Sign-In cancellation gracefully
      // When user dismisses the Apple prompt, signInAsync throws ERR_REQUEST_CANCELED
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Error & { code: string }).code === 'ERR_REQUEST_CANCELED'
      ) {
        set({ isLoading: false });
        return { success: false, error: 'Sign in was cancelled' };
      }

      const message =
        error instanceof Error ? error.message : 'Failed to sign in with Apple';
      log.error('Apple sign-in error:', error);
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Sign out
  signOut: async () => {
    try {
      set({ isLoading: true });

      // 2026 Best Practice: Do NOT call cleanup() here.
      // The onAuthStateChange listener must survive sign-out so it can
      // detect subsequent sign-ins (e.g., Google OAuth). The listener's
      // SIGNED_OUT handler (line ~361) already clears user/session/customer.
      // cleanup() is reserved for app unmount only (root layout teardown).

      await supabase.auth.signOut();
      // Clear entire cart on logout to prevent cart data leakage between users.
      useCartStore.getState().clearCart();
      set({
        user: null,
        session: null,
        customer: null,
        isLoading: false,
        isInitialized: true, // 2026 Fix: Keep initialized after sign out to allow redirects
        _initializationInProgress: false,
      } as Partial<AuthState>);
    } catch (error) {
      log.error('Sign out error:', error);
      set({ isLoading: false });
    }
  },

  // Delete current customer account for storefront app review compliance.
  deleteAccount: async () => {
    const user = get().user;
    if (!user) {
      return {
        success: false,
        error: 'You must be signed in to delete your account.',
      };
    }

    const usedApple = hasAppleProvider(user);

    try {
      set({ isLoading: true, error: null });

      const { error } = await supabase.rpc('delete_current_storefront_account');

      if (error) {
        const message = getDeleteAccountErrorMessage(error);
        set({ error: message, isLoading: false });
        return { success: false, error: message, usedApple };
      }

      try {
        await supabase.auth.signOut();
      } catch (signOutError) {
        log.warn('Sign-out after account deletion failed:', signOutError);
      }

      useCartStore.getState().clearCart();
      set({
        user: null,
        session: null,
        customer: null,
        isLoading: false,
        isInitialized: true,
        _initializationInProgress: false,
      } as Partial<AuthState>);

      return { success: true, usedApple };
    } catch (error) {
      const message = getDeleteAccountErrorMessage(error);
      set({ error: message, isLoading: false });
      return { success: false, error: message, usedApple };
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

      // BUG-3-006: Validate auth server-side before profile update
      const {
        data: { user: verifiedUser },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !verifiedUser) {
        log.warn('Session expired during profile update');
        return {
          success: false,
          error: 'Session expired. Please sign in again.',
        };
      }

      // M3 fix: Filter out undefined values to prevent nulling-out existing data
      const updates = Object.fromEntries(
        Object.entries({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
        }).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(updates).length === 0) {
        return { success: true }; // Nothing to update
      }

      const { data: updated, error } = await supabase
        .from('customers')
        .update(updates)
        .eq('id', customer.id)
        .eq('merchant_id', merchantId)
        .select('id, email, first_name, last_name, phone, loyalty_points')
        .single();

      if (error) {
        return { success: false, error: error.message };
      }

      // BUG-3-013: Validate DB update response before storing
      const updateValidation = CustomerRowSchema.safeParse(updated);
      if (!updateValidation.success) {
        log.warn(
          'Invalid customer data from update:',
          updateValidation.error.flatten()
        );
        return { success: false, error: 'Invalid data received from server' };
      }

      const validatedCustomer = {
        id: updateValidation.data.id,
        email: updateValidation.data.email,
        first_name: updateValidation.data.first_name ?? undefined,
        last_name: updateValidation.data.last_name ?? undefined,
        phone: updateValidation.data.phone ?? undefined,
        loyalty_points: updateValidation.data.loyalty_points ?? undefined,
      };

      set({ customer: validatedCustomer });
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
