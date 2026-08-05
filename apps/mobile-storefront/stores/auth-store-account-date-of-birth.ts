import { supabase } from '../lib/supabase';
import type { AuthStoreGet, AuthStoreSet } from './auth-store.types';
import { profileRpcErrorMessages } from './auth-store-error-messages';

export function createDateOfBirthAction(set: AuthStoreSet, get: AuthStoreGet) {
  return {
    setDateOfBirth: async (dateOfBirth: string) => {
      try {
        const { merchantId } = get();
        if (!merchantId) return { success: false, error: 'Not logged in' };

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
