import { CONFIG } from '../lib/config';
import { supabase } from '../lib/supabase';
import type { AuthStoreSet } from './auth-store.types';

const OTP_EMAIL_REDIRECT_URL = `https://${CONFIG.MERCHANT_SLUG}.usebaci.com/account/verify`;

export function createCredentialActions(set: AuthStoreSet) {
  return {
    signInWithOtp: async (email: string) => {
      try {
        set({ isLoading: true, error: null });
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: {
            shouldCreateUser: true,
            emailRedirectTo: OTP_EMAIL_REDIRECT_URL,
            data: { role: 'customer' },
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
