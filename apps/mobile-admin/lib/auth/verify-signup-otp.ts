import type { Session, User } from '@supabase/supabase-js';
import { isConnectivityError } from '@/lib/api-errors';
import { supabase } from '@/lib/supabase';

export interface VerifySignupOtpResult {
  error: string | null;
  sessionEstablished?: true;
}

interface VerificationStateUpdate {
  isAuthenticated: boolean;
  isInitialized: boolean;
  isLoading: boolean;
  session: Session;
  user: User;
}

interface RunSignupOtpVerificationOptions {
  email: string;
  getCurrentUserId: () => string | undefined;
  onResetUserStores: () => Promise<void>;
  setState: (state: VerificationStateUpdate) => void;
  token: string;
}

function verificationErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/expired|invalid|token.*not found|otp/i.test(message)) {
    return 'That verification code is invalid or expired. Request a new code and try again.';
  }
  if (isConnectivityError(error)) {
    return 'Unable to connect. Check your internet connection and try again.';
  }
  return 'Email verification failed. Request a new code and try again.';
}

export async function runSignupOtpVerification({
  email,
  getCurrentUserId,
  onResetUserStores,
  setState,
  token,
}: RunSignupOtpVerificationOptions): Promise<VerifySignupOtpResult> {
  try {
    const { data, error } = await supabase.auth.verifyOtp({
      email,
      token,
      type: 'signup',
    });

    if (error) {
      return { error: verificationErrorMessage(error) };
    }
    if (!data.session || !data.user) {
      return {
        error:
          'Email verification did not finish. Request a new code and try again.',
      };
    }

    if (getCurrentUserId() !== data.user.id) {
      await onResetUserStores();
    }
    setState({
      isAuthenticated: true,
      isInitialized: true,
      isLoading: false,
      session: data.session,
      user: data.user,
    });

    return { error: null, sessionEstablished: true };
  } catch (error) {
    return { error: verificationErrorMessage(error) };
  }
}
