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
import { CUSTOMER_SELECT_COLUMNS } from './auth-customer-schema-compat';
import type { AuthStoreGet, AuthStoreSet, Customer } from './auth-store.types';
import { profileRpcErrorMessages } from './auth-store-error-messages';
import { clearLocalAndDeactivatePushToken } from './auth-store-push';
import {
  getUsernameCooldownNextEligibleAt,
  getUsernamePolicyError,
  parseUsernameWriteResult,
} from './auth-username-policy';
import { useCartStore } from './cart-store';
import { useComparisonStore } from './comparison-store';
import { useQuizStore } from './quiz-store';
import { useSavedStore } from './saved-store';

const log = createLogger('AuthStore');

type AccountIdentity = {
  merchantId: string;
  userId: string | null;
  customerId: string | null;
};

function getAccountUserId(state: ReturnType<AuthStoreGet>) {
  return state.user?.id ?? state.customer?.user_id ?? null;
}

function captureAccountIdentity(
  state: ReturnType<AuthStoreGet>,
  merchantId: string,
  customer: Customer | null
): AccountIdentity {
  return {
    merchantId,
    userId: getAccountUserId(state),
    customerId: customer?.id ?? null,
  };
}

function isSameInitiatingAccount(
  identity: AccountIdentity,
  state: ReturnType<AuthStoreGet>
) {
  if (state.merchantId !== identity.merchantId) return false;

  const currentUserId = getAccountUserId(state);
  if (identity.userId && currentUserId !== identity.userId) return false;

  // A temporarily missing customer row is expected during hydration. A present
  // row with a different id, however, belongs to a different account and must
  // never receive the previous account's asynchronous response.
  return !(
    identity.customerId &&
    state.customer &&
    state.customer.id !== identity.customerId
  );
}

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
        const initialState = get();
        const { customer, merchantId } = initialState;
        if (!customer || !merchantId) {
          return { success: false, error: 'Not logged in' };
        }
        const initiatingAccount = captureAccountIdentity(
          initialState,
          merchantId,
          customer
        );

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
        if (
          initiatingAccount.userId &&
          verifiedUser.id !== initiatingAccount.userId
        ) {
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

        if (!isSameInitiatingAccount(initiatingAccount, get())) {
          // The update committed for the initiating account, but the app has
          // since switched accounts. Keep the new account's local state intact.
          return { success: true };
        }

        // updateProfile never writes username, so the response's username is a
        // point-in-time read that can be STALE if a concurrent setUsername
        // resolved while this update was in flight (the mirror of the race
        // handled in setUsername below). Prefer the live store value — it can
        // only be newer, since this action cannot legitimately change it.
        const liveCustomer = get().customer;
        // Same stale-read race as username: updateProfile never writes
        // date_of_birth, so a concurrent setDateOfBirth could have resolved
        // while this update was in flight. Prefer the live store value.
        const liveDateOfBirth = liveCustomer?.date_of_birth;
        const nextCustomer: Customer = {
          id: updateValidation.data.id,
          user_id: updateValidation.data.user_id,
          email: updateValidation.data.email,
          first_name: updateValidation.data.first_name ?? undefined,
          last_name: updateValidation.data.last_name ?? undefined,
          phone: updateValidation.data.phone ?? undefined,
          loyalty_points: updateValidation.data.loyalty_points ?? undefined,
          username:
            liveCustomer?.username ??
            updateValidation.data.username ??
            undefined,
          username_changed_at:
            liveCustomer?.username_changed_at ??
            updateValidation.data.username_changed_at ??
            undefined,
          username_next_eligible_at:
            liveCustomer?.username_next_eligible_at ?? undefined,
          date_of_birth:
            liveDateOfBirth ?? updateValidation.data.date_of_birth ?? undefined,
        };
        set({ customer: nextCustomer });
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to update profile';
        return { success: false, error: message };
      }
    },

    setUsername: async (username: string) => {
      try {
        const initialState = get();
        const { merchantId } = initialState;
        if (!merchantId) {
          return { success: false, error: 'Not logged in' };
        }
        const initiatingAccount = captureAccountIdentity(
          initialState,
          merchantId,
          initialState.customer
        );

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
        if (
          initiatingAccount.userId &&
          verifiedUser.id !== initiatingAccount.userId
        ) {
          return {
            success: false,
            error: 'Session expired. Please sign in again.',
          };
        }

        const cleaned = cleanUsername(username);
        const { data, error } = await supabase.rpc('set_customer_username_v2', {
          p_merchant_id: merchantId,
          p_username: cleaned,
        });
        if (error) {
          const nextEligibleAt = getUsernameCooldownNextEligibleAt(error);
          const latestCustomer = get().customer;
          if (
            nextEligibleAt &&
            latestCustomer &&
            isSameInitiatingAccount(initiatingAccount, get())
          ) {
            set({
              customer: {
                ...latestCustomer,
                username_next_eligible_at: nextEligibleAt,
              },
            });
          }
          return {
            success: false,
            error: getUsernamePolicyError(error),
          };
        }

        const result = parseUsernameWriteResult(data);
        if (!result) {
          return { success: false, error: 'Invalid data received from server' };
        }
        const latestCustomer = get().customer;
        if (
          latestCustomer &&
          isSameInitiatingAccount(initiatingAccount, get())
        ) {
          const nextCustomer: Customer = {
            ...latestCustomer,
            username: result.username,
            username_changed_at: result.usernameChangedAt,
            username_next_eligible_at: result.nextEligibleAt,
          };
          set({ customer: nextCustomer });
        }
        return { success: true, username: result.username };
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
