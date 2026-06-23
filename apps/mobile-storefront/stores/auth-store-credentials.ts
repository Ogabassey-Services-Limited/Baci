import {
  sendStorefrontOtp,
  verifyStorefrontOtp,
} from '@/lib/storefront-auth-api';
import { supabase } from '../lib/supabase';
import type { AuthStoreGet, AuthStoreSet } from './auth-store.types';
import { syncAuthenticatedState } from './auth-store-sync';

export type StorefrontOtpApi = {
  sendStorefrontOtp: typeof sendStorefrontOtp;
  setSession: typeof supabase.auth.setSession;
  syncAuthenticatedState: typeof syncAuthenticatedState;
  verifyStorefrontOtp: typeof verifyStorefrontOtp;
};

function getDefaultStorefrontOtpApi(): StorefrontOtpApi {
  return {
    sendStorefrontOtp,
    setSession: (session) => supabase.auth.setSession(session),
    syncAuthenticatedState,
    verifyStorefrontOtp,
  };
}

export function createCredentialActions(
  set: AuthStoreSet,
  get: AuthStoreGet,
  storefrontOtpApi: StorefrontOtpApi = getDefaultStorefrontOtpApi()
) {
  return {
    signInWithOtp: async (email: string) => {
      try {
        set({ isLoading: true, error: null });
        const result = await storefrontOtpApi.sendStorefrontOtp(email);
        if (!result.success) {
          set({ error: result.error, isLoading: false });
          return { success: false, error: result.error };
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
    verifyOtp: async (email: string, token: string) => {
      try {
        set({ isLoading: true, error: null });
        const result = await storefrontOtpApi.verifyStorefrontOtp(email, token);
        if (!result.success) {
          set({ error: result.error, isLoading: false });
          return { success: false, error: result.error };
        }

        const { data: sessionData, error: sessionError } =
          await storefrontOtpApi.setSession({
            access_token: result.data.access_token,
            refresh_token: result.data.refresh_token,
          });
        if (sessionError) {
          set({ error: sessionError.message, isLoading: false });
          return { success: false, error: sessionError.message };
        }

        const establishedSession = sessionData.session ?? null;
        const authenticatedUser =
          establishedSession?.user ?? sessionData.user ?? null;
        if (!authenticatedUser) {
          const message = 'Unable to complete sign-in. Please try again.';
          set({ error: message, isLoading: false });
          return { success: false, error: message };
        }

        await storefrontOtpApi.syncAuthenticatedState({
          merchantId: get().merchantId,
          session: establishedSession,
          set,
          user: authenticatedUser,
        });

        set({ isLoading: false });
        return { success: true };
      } catch (error) {
        const message =
          error instanceof Error ? error.message : 'Failed to verify OTP';
        set({ error: message, isLoading: false });
        return { success: false, error: message };
      }
    },
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
  };
}
