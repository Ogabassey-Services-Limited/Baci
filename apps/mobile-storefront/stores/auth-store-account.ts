import { cleanUsername } from '@/schemas/username';
import {
  type DeleteAccountResult,
  getDeleteAccountErrorMessage,
} from '../lib/account-deletion';
import { createLogger } from '../lib/logger';
import { getStoredPushToken } from '../lib/push-token-storage';
import { queryClient } from '../lib/query-client';
import { supabase } from '../lib/supabase';
import { CustomerRowSchema } from '../lib/validation';
import { CUSTOMER_SELECT_COLUMNS } from './auth-helpers';
import type { AuthStoreGet, AuthStoreSet, Customer } from './auth-store.types';
import { profileRpcErrorMessages } from './auth-store-error-messages';
import { clearLocalAndDeactivatePushToken } from './auth-store-push';
import { useCartStore } from './cart-store';
import { useComparisonStore } from './comparison-store';
import { useQuizStore } from './quiz-store';
import { useSavedStore } from './saved-store';

const log = createLogger('AuthStore');

function clearUserStores() {
  queryClient.clear();
  useCartStore.getState().clearCart();
  useSavedStore.getState().clearSaved();
  useComparisonStore.getState().clearComparison();
  // Prevent a signed-out (or switched) user from seeing the prior account's
  // quiz attempt, result, or won-prize claim.
  useQuizStore.getState().reset();
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
        // Same stale-read race as username: updateProfile never writes
        // date_of_birth, so a concurrent setDateOfBirth could have resolved
        // while this update was in flight. Prefer the live store value.
        const liveDateOfBirth = get().customer?.date_of_birth;
        set({
          customer: {
            id: updateValidation.data.id,
            user_id: updateValidation.data.user_id,
            email: updateValidation.data.email,
            first_name: updateValidation.data.first_name ?? undefined,
            last_name: updateValidation.data.last_name ?? undefined,
            phone: updateValidation.data.phone ?? undefined,
            loyalty_points: updateValidation.data.loyalty_points ?? undefined,
            username:
              liveUsername ?? updateValidation.data.username ?? undefined,
            date_of_birth:
              liveDateOfBirth ??
              updateValidation.data.date_of_birth ??
              undefined,
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
          return {
            success: false,
            error: profileRpcErrorMessages.username(error.message),
          };
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

    setDateOfBirth: async (dateOfBirth: string) => {
      try {
        // Only merchantId is required: the RPC re-derives the customer from
        // auth.uid() + merchant, so a shopper whose local customer row failed to
        // hydrate can still save (and then pass the server age gate). The
        // getUser() check below still rejects a genuinely signed-out session.
        const { merchantId } = get();
        if (!merchantId) {
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

        // The RPC re-derives the customer from auth.uid() + merchant, validates
        // the ISO date server-side, and raises friendly codes.
        const { data, error } = await supabase.rpc(
          'set_customer_date_of_birth',
          {
            p_merchant_id: merchantId,
            p_date_of_birth: dateOfBirth,
          }
        );
        if (error) {
          return {
            success: false,
            error: profileRpcErrorMessages.dateOfBirth(error.message),
          };
        }

        const stored = typeof data === 'string' ? data : dateOfBirth;
        // Re-read the customer instead of spreading the top-of-function
        // snapshot: two awaits (getUser + the RPC) ran since, during which a
        // concurrent updateProfile could have replaced `customer`. Patch local
        // state only when the row is present; if hydration failed the write
        // still succeeded server-side and is picked up on the next sync.
        const latestCustomer = get().customer;
        if (latestCustomer) {
          set({ customer: { ...latestCustomer, date_of_birth: stored } });
        }
        return { success: true, dateOfBirth: stored };
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : 'Could not save date of birth';
        return { success: false, error: message };
      }
    },
  };
}
