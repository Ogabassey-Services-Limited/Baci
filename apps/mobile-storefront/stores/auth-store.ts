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
import { Alert } from 'react-native';
import { create } from 'zustand';
import {
  type DeleteAccountResult,
  getDeleteAccountErrorMessage,
} from '../lib/account-deletion';
import { CONFIG } from '../lib/config';
import { createLogger } from '../lib/logger';
import { supabase } from '../lib/supabase';
import { CustomerRowSchema, MerchantRowSchema } from '../lib/validation';
import {
  hydrateCustomer,
  initTimeout,
  shouldInvalidateSessionOnGetUserError,
} from './auth-helpers';
import { useCartStore } from './cart-store';
import { useComparisonStore } from './comparison-store';
import { useSavedStore } from './saved-store';

const log = createLogger('AuthStore');

// Get merchant slug from app config
const MERCHANT_SLUG = CONFIG.MERCHANT_SLUG;

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
  // Internal: generation counter to invalidate stale initializations
  _initGen: number;

  // Actions
  initialize: () => Promise<void>;
  cleanup: () => void;
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

type AuthStoreSet = (state: Partial<AuthState>) => void;

async function syncAuthenticatedState({
  getInitGen,
  initGen,
  merchantId,
  session,
  set,
  skipImmediateState = false,
  user,
}: {
  getInitGen?: () => number;
  initGen?: number;
  merchantId: string | null;
  session: Session | null;
  set: AuthStoreSet;
  skipImmediateState?: boolean;
  user: User;
}): Promise<void> {
  const isStale =
    initGen !== undefined &&
    getInitGen !== undefined &&
    getInitGen() !== initGen;

  if (!skipImmediateState) {
    // Set auth state immediately so auth-gated screens can react to the new
    // session even if the async browser context is lost during OAuth return.
    set({
      error: null,
      isInitialized: true,
      session,
      user,
    });
  }

  if (isStale) {
    return;
  }

  if (!merchantId) {
    set({ customer: null });
    return;
  }

  try {
    const customer = await hydrateCustomer({
      getInitGen,
      initGen,
      merchantId,
      user,
      useTimeout: false,
    });

    if (
      initGen !== undefined &&
      getInitGen !== undefined &&
      getInitGen() !== initGen
    ) {
      return;
    }

    set({ customer });
  } catch (error) {
    if (
      initGen !== undefined &&
      getInitGen !== undefined &&
      getInitGen() !== initGen
    ) {
      return;
    }

    log.warn('Post-auth customer hydration failed:', error);
    set({ customer: null });
  }
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
  _initGen: 0,

  // Initialize auth state
  initialize: async () => {
    // 2026 Critical Fix: Prevent race conditions from multiple initialize() calls
    const state = get() as AuthState & { _initializationInProgress: boolean };
    if (state._initializationInProgress || state.isInitialized) {
      log.debug('Initialize already in progress or completed, skipping');
      return;
    }

    const initGen = Date.now();
    set({
      _initializationInProgress: true,
      _initGen: initGen,
    } as Partial<AuthState>);

    try {
      set({ isLoading: true, error: null });

      // First, get the merchant ID for this store
      const { data: merchant, error: merchantError } = await initTimeout(
        supabase
          .from('merchants')
          .select('id')
          .eq('slug', MERCHANT_SLUG)
          .single(),
        'merchant lookup'
      );

      if (get()._initGen !== initGen) return;

      // 2026 Best Practice: Validate merchant data
      const merchantValidation = MerchantRowSchema.safeParse(merchant);

      let resolvedMerchantId: string | null = null;
      if (merchantError || !merchantValidation.success) {
        const errorDetails = merchantValidation.success
          ? 'Database error'
          : JSON.stringify(merchantValidation.error.flatten());
        log.warn(
          `Store "${MERCHANT_SLUG}" not found in database. Continuing with limited auth mode. Details: ${errorDetails}`
        );
        set({ merchantId: null });
      } else {
        resolvedMerchantId = merchantValidation.data.id;
        set({ merchantId: resolvedMerchantId });
      }

      // Get current session
      const {
        data: { session: initialSession },
        error: sessionError,
      } = await initTimeout(supabase.auth.getSession(), 'getSession');

      if (get()._initGen !== initGen) return;

      if (sessionError) {
        throw sessionError;
      }

      let session = initialSession;

      // After getting session, validate JWT with server
      if (session) {
        const { error: userError } = await initTimeout(
          supabase.auth.getUser(),
          'getUser'
        );

        if (get()._initGen !== initGen) return;

        if (userError) {
          if (shouldInvalidateSessionOnGetUserError(userError)) {
            // JWT invalid/expired — attempt refresh before giving up
            log.warn(
              'Session JWT validation failed, attempting refresh:',
              userError.message
            );
            const {
              data: { session: refreshedSession },
              error: refreshError,
            } = await initTimeout(
              supabase.auth.refreshSession(),
              'refreshSession'
            );

            if (get()._initGen !== initGen) return;

            if (refreshError || !refreshedSession) {
              log.warn(
                'Session refresh failed, entering guest mode:',
                refreshError?.message ?? 'no session returned'
              );
              // Clear persisted auth tokens so the next cold start doesn't
              // attempt to resume this dead session.
              await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
              session = null;
            } else {
              log.info('Session refreshed successfully');
              session = refreshedSession;
            }
          } else {
            // Transient network/service error — keep local session
            log.warn(
              'Session validation skipped due to transient auth error:',
              userError.message
            );
          }
        }
      }

      if (session?.user) {
        // Preserve the authenticated session immediately after app restore so
        // OAuth round-trips do not block on customer hydration or surface a
        // false timeout LogBox while the app is already signed in.
        set({
          user: session.user,
          session,
          customer: null,
          isLoading: false,
          isInitialized: true,
        });

        if (resolvedMerchantId) {
          void syncAuthenticatedState({
            getInitGen: () => get()._initGen,
            initGen,
            merchantId: resolvedMerchantId,
            session,
            set,
            skipImmediateState: true,
            user: session.user,
          });
        }
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
      const { data: authListener } = supabase.auth.onAuthStateChange(
        async (event, session) => {
          log.debug('Auth state changed:', event);
          const { merchantId } = get();

          try {
            if (event === 'SIGNED_IN' && session?.user) {
              await syncAuthenticatedState({
                merchantId,
                session,
                set,
                user: session.user,
              });

              // 2026 Best Practice: Sync guest cart after login
              const guestCartItems = useCartStore.getState().items;
              if (guestCartItems.length > 0) {
                log.info(
                  `Cart sync: ${guestCartItems.length} items preserved after login`
                );
              }
            } else if (event === 'SIGNED_OUT') {
              // 2026 Critical Fix: Reset user stores to prevent data bleed on session expiry
              useCartStore.getState().clearCart();
              useSavedStore.getState().clearSaved();
              useComparisonStore.getState().clearComparison();
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
          }
        }
      );

      // Store subscription reference for cleanup
      if (get()._initGen !== initGen) {
        log.debug(
          'Initialization cancelled/superseded, unsubscribing listener'
        );
        authListener.subscription.unsubscribe();
        return;
      }

      set({
        _authSubscription: authListener,
        _initializationInProgress: false,
      } as Partial<AuthState>);
    } catch (error) {
      if (get()._initGen !== initGen) return;

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
    set({
      _initGen: Date.now(),
      _initializationInProgress: false,
    } as Partial<AuthState>);

    const state = get() as AuthState & {
      _authSubscription: {
        subscription: { unsubscribe: () => void };
      } | null;
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
        options: { shouldCreateUser: true },
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

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to verify OTP';
      set({ error: message, isLoading: false });
      return { success: false, error: message };
    }
  },

  // Sign in with email/password
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

  // Sign in with Google OAuth (Implicit flow)
  signInWithGoogle: async () => {
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

      const redirectUrl = makeRedirectUri();
      log.debug('Generated OAuth redirect URL:', redirectUrl);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirectUrl,
          skipBrowserRedirect: true,
          queryParams: { access_type: 'offline', prompt: 'consent' },
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

        const establishedSession = sessionData.session ?? null;
        const authenticatedUser =
          establishedSession?.user ?? sessionData.user ?? null;

        if (!authenticatedUser) {
          log.error('OAuth session established without a user');
          set({ isLoading: false });
          return {
            success: false,
            error: 'Unable to complete sign-in. Please try again.',
          };
        }

        await syncAuthenticatedState({
          merchantId: get().merchantId,
          session: establishedSession,
          set,
          user: authenticatedUser,
        });

        log.info('Session established');
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

  // Sign in with Apple
  signInWithApple: async () => {
    try {
      set({ isLoading: true, error: null });

      let AppleAuthentication;
      try {
        AppleAuthentication = await import('expo-apple-authentication');
      } catch (_e) {
        throw new Error(
          'expo-apple-authentication not installed. Please run "npx expo install expo-apple-authentication"'
        );
      }

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

      // Apple only returns name on the VERY FIRST sign-in
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

      const authenticatedSession = data.session ?? null;
      const authenticatedUser = authenticatedSession?.user ?? data.user ?? null;

      if (!authenticatedUser) {
        log.error('Apple OAuth completed without a user');
        set({ isLoading: false });
        return {
          success: false,
          error: 'Unable to complete sign-in. Please try again.',
        };
      }

      await syncAuthenticatedState({
        merchantId: get().merchantId,
        session: authenticatedSession,
        set,
        user: authenticatedUser,
      });

      // If we got a name, and it's a new user, update metadata + customer record
      if (fullName && data.user && !data.user.user_metadata?.full_name) {
        log.info('Updating user metadata with Apple name');
        const { error: updateError } = await supabase.auth.updateUser({
          data: { full_name: fullName },
        });

        if (updateError) {
          log.warn('Failed to update user metadata:', updateError.message);
        }

        const { merchantId } = get();
        if (merchantId && data.user.email) {
          const { error: rpcError } = await supabase.rpc(
            'upsert_customer_on_auth',
            {
              p_merchant_id: merchantId,
              p_user_id: data.user.id,
              p_email: data.user.email,
              p_full_name: fullName,
              p_phone: null,
            }
          );
          if (rpcError) {
            log.error('Apple name upsert RPC failed:', rpcError.message);
          }
        }
      }

      set({ isLoading: false });
      return { success: true };
    } catch (error) {
      // Handle Apple Sign-In cancellation gracefully
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
      await supabase.auth.signOut();
      useCartStore.getState().clearCart();
      useSavedStore.getState().clearSaved();
      useComparisonStore.getState().clearComparison();
      set({
        user: null,
        session: null,
        customer: null,
        isLoading: false,
        isInitialized: true,
        _initializationInProgress: false,
      } as Partial<AuthState>);
    } catch (error) {
      log.error('Sign out error:', error);
      set({ isLoading: false });
    }
  },

  // Delete account (Apple Guideline 5.1.1(v) compliance)
  deleteAccount: async () => {
    try {
      const { user } = get();
      const usedApple =
        user?.app_metadata?.providers?.includes('apple') ?? false;

      const { error } = await supabase.rpc('delete_current_storefront_account');

      if (error) {
        const message = getDeleteAccountErrorMessage(error);
        return { success: false, error: message };
      }

      // Sign out and clear local stores
      await supabase.auth.signOut({ scope: 'local' }).catch((err) => {
        log.warn('Local signOut failed after account deletion:', err);
      });
      useCartStore.getState().clearCart();
      useSavedStore.getState().clearSaved();
      useComparisonStore.getState().clearComparison();
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
      const message =
        error instanceof Error
          ? error.message
          : 'Something went wrong. Please try again.';
      return { success: false, error: message };
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

      const updates = Object.fromEntries(
        Object.entries({
          first_name: data.first_name,
          last_name: data.last_name,
          phone: data.phone,
        }).filter(([, v]) => v !== undefined)
      );

      if (Object.keys(updates).length === 0) {
        return { success: true };
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

      // Validate DB update response before storing
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
