import {
  getDeleteAccountErrorMessage,
  type DeleteAccountResult,
} from '../lib/account-deletion';
import { createLogger } from '../lib/logger';
import { queryClient } from '../lib/query-client';
import { getStoredPushToken } from '../lib/push-token-storage';
import { cleanUsername } from '@/schemas/username';
import { supabase } from '../lib/supabase';
import { CustomerRowSchema } from '../lib/validation';
import { CUSTOMER_SELECT_COLUMNS } from './auth-helpers';
import { clearLocalAndDeactivatePushToken } from './auth-store-push';
import type { AuthStoreGet, AuthStoreSet, Customer } from './auth-store.types';
import { useCartStore } from './cart-store';
import { useComparisonStore } from './comparison-store';
import { useSavedStore } from './saved-store';

const log = createLogger('AuthStore');

// set_customer_username raises these as the Postgres error message.
const USERNAME_ERROR_MESSAGES: Record<string, string> = {
  username_taken: 'That username is already taken. Try another.',
  reserved_username: 'That username is not available.',
  invalid_username:
    'Use 3-20 letters, numbers, or single . _ separators (start and end with a letter or number).',
  customer_not_found: 'No shopper account found for this store.',
  not_authenticated: 'Please sign in to choose a username.',
};

function mapUsernameError(message: string): string {
  return USERNAME_ERROR_MESSAGES[message] ?? 'Could not set username';
}

function clearUserStores() {
  queryClient.clear();
  useCartStore.getState().clearCart();
  useSavedStore.getState().clearSaved();
  useComparisonStore.getState().clearComparison();
}

export function createAccountActions(set: AuthStoreSet, get: AuthStoreGet) {
  return {
    signOut: async () => {
      try {
        set({ isLoading: true });
        const storedToken = await getStoredPushToken();
        await clearLocalAndDeactivatePushToken(storedToken);
        await supabase.auth.signOut();
        clearUserStores();
        set({
          user: null,
          session: null,
          customer: null,
          isLoading: false,
          isInitialized: true,
          _initializationInProgress: false,
        });
      } catch (error) {
        log.error('Sign out error:', error);
        set({ isLoading: false });
      }
    },
    deleteAccount: async (): Promise<DeleteAccountResult> => {
      try {
        const { user } = get();
        const usedApple =
          user?.app_metadata?.providers?.includes('apple') ?? false;
        const { error } = await supabase.rpc(
          'delete_current_storefront_account'
        );
        if (error) {
          return { success: false, error: getDeleteAccountErrorMessage(error) };
        }

        const storedToken = await getStoredPushToken();
        await clearLocalAndDeactivatePushToken(storedToken);
        await supabase.auth.signOut({ scope: 'local' }).catch((err) => {
          log.warn('Local signOut failed after account deletion:', err);
        });
        clearUserStores();
        set({
          user: null,
          session: null,
          customer: null,
          isLoading: false,
          isInitialized: true,
          _initializationInProgress: false,
        });

        return { success: true, usedApple };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Something went wrong. Please try again.';
        return { success: false, error: message };
      }
    },
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
        if (session) set({ session });
      } catch (error) {
        log.error('Session refresh error:', error);
      }
    },
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
          }).filter(([, value]) => value !== undefined)
        );
        if (Object.keys(updates).length === 0) return { success: true };

        const { data: updated, error } = await supabase
          .from('customers')
          .update(updates)
          .eq('id', customer.id)
          .eq('merchant_id', merchantId)
          .select(CUSTOMER_SELECT_COLUMNS)
          .single();
        if (error) return { success: false, error: error.message };

        const updateValidation = CustomerRowSchema.safeParse(updated);
        if (!updateValidation.success) {
          return { success: false, error: 'Invalid data received from server' };
        }

        // updateProfile never writes username, so the response's username is a
        // point-in-time read that can be STALE if a concurrent setUsername
        // resolved while this update was in flight (the mirror of the race
        // handled in setUsername below). Prefer the live store value — it can
        // only be newer, since this action cannot legitimately change it.
        const liveUsername = get().customer?.username;
        set({
          customer: {
            id: updateValidation.data.id,
            email: updateValidation.data.email,
            first_name: updateValidation.data.first_name ?? undefined,
            last_name: updateValidation.data.last_name ?? undefined,
            phone: updateValidation.data.phone ?? undefined,
            loyalty_points: updateValidation.data.loyalty_points ?? undefined,
            username:
              liveUsername ?? updateValidation.data.username ?? undefined,
          },
        });
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update profile';
        return { success: false, error: message };
      }
    },

    setUsername: async (username: string) => {
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
          return {
            success: false,
            error: 'Session expired. Please sign in again.',
          };
        }

        // Normalize (NFKC + zero-width strip + trim) at the RPC boundary, the
        // same way the web API route does, so both clients send identical input.
        const cleaned = cleanUsername(username);

        // The RPC re-derives the customer from auth.uid() + merchant, enforces
        // per-merchant case-insensitive uniqueness, and raises friendly codes.
        const { data, error } = await supabase.rpc('set_customer_username', {
          p_merchant_id: merchantId,
          p_username: cleaned,
        });
        if (error) {
          return { success: false, error: mapUsernameError(error.message) };
        }

        const stored = typeof data === 'string' ? data : cleaned;
        // Re-read the customer instead of spreading the top-of-function
        // snapshot: two awaits (getUser + the RPC) ran since, during which a
        // concurrent updateProfile could have replaced `customer`. Spreading the
        // stale copy would silently clobber that change.
        const latestCustomer = get().customer;
        if (!latestCustomer) {
          return { success: false, error: 'Not logged in' };
        }
        set({ customer: { ...latestCustomer, username: stored } });
        return { success: true, username: stored };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Could not set username';
        return { success: false, error: message };
      }
    },
  };
}
