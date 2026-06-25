'use client';

/**
 * useOgabasseyLogin Hook
 *
 * 2026 Best Practices:
 * - Separation of concerns (logic from UI)
 * - Type-safe return values
 * - Testable business logic
 * - Centralized state management
 */

import { useRouter } from 'next/navigation';
import { useRef, useState } from 'react';
import { useCustomerAuth } from '@/contexts/customer-auth-context';
import { asRoute } from '@/lib/routes';
import type { OtpCode, UseOgabasseyLoginReturn } from '../types';

interface UseOgabasseyLoginOptions {
  redirectTo: string;
}

/**
 * Runs a social sign-in flow, surfacing failures and always clearing the
 * loading flag. Module-scope so the try/finally stays outside the hook body.
 */
async function runSocialSignIn(
  signIn: () => Promise<{ success: boolean; error?: string }>,
  fallbackError: string,
  setError: (message: string) => void,
  setLoading: (loading: boolean) => void
): Promise<void> {
  try {
    const result = await signIn();

    if (!result.success) {
      setError(result.error || fallbackError);
    }
    // On success, OAuth redirect will navigate away
  } finally {
    setLoading(false);
  }
}

/**
 * Custom hook for Ogabassey login page logic
 *
 * Handles:
 * - Email/OTP authentication flow
 * - Social sign-in (Google, Apple)
 * - OTP code input management
 * - Error handling
 */
export function useOgabasseyLogin({
  redirectTo,
}: UseOgabasseyLoginOptions): UseOgabasseyLoginReturn {
  const router = useRouter();
  const {
    otpState,
    sendOtp,
    verifyOtp,
    signInWithGoogle,
    signInWithApple,
  } = useCustomerAuth();

  // Form state
  const [email, setEmail] = useState('');
  const [code, setCode] = useState<OtpCode>(['', '', '', '', '', '']);
  const [error, setError] = useState('');

  // Loading states
  const [isSending, setIsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);

  // Refs for OTP inputs
  const codeInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  /**
   * Send OTP code to email
   */
  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsSending(true);

    const result = await sendOtp(email);

    if (!result.success) {
      setError(result.error || 'Failed to send code');
    }

    setIsSending(false);
  };

  /**
   * Verify OTP code
   */
  const verifyCode = async (codeString: string) => {
    setError('');
    setIsVerifying(true);

    const result = await verifyOtp(codeString);

    if (!result.success) {
      setError(result.error || 'Verification failed');
      setCode(['', '', '', '', '', '']);
      codeInputRefs.current[0]?.focus();
    } else {
      router.push(asRoute(redirectTo));
    }

    setIsVerifying(false);
  };

  /**
   * Handle single digit change in OTP input
   */
  const handleCodeChange = (index: number, value: string) => {
    // Only allow single digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...code] as OtpCode;
    newCode[index] = value;
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      codeInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newCode.every((d) => d) && newCode.join('').length === 6) {
      verifyCode(newCode.join(''));
    }
  };

  /**
   * Handle backspace navigation in OTP input
   */
  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>
  ) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      codeInputRefs.current[index - 1]?.focus();
    }
  };

  /**
   * Handle paste in OTP input
   */
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pastedData)) return;

    const newCode = [...code] as OtpCode;
    for (let i = 0; i < pastedData.length && i < 6; i++) {
      newCode[i] = pastedData[i];
    }
    setCode(newCode);

    // Auto-submit when complete
    if (newCode.every((d) => d) && newCode.join('').length === 6) {
      verifyCode(newCode.join(''));
    }
  };

  /**
   * Resend OTP code
   */
  const handleResendCode = async () => {
    setError('');
    setIsSending(true);
    setCode(['', '', '', '', '', '']);

    const result = await sendOtp(otpState?.email || email);

    if (!result.success) {
      setError(result.error || 'Failed to resend code');
    }

    setIsSending(false);
  };

  /**
   * Go back to email entry (change email)
   */
  const handleChangeEmail = () => {
    setCode(['', '', '', '', '', '']);
    setError('');
  };

  /**
   * Sign in with Google
   */
  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    await runSocialSignIn(
      signInWithGoogle,
      'Failed to sign in with Google',
      setError,
      setIsGoogleLoading
    );
  };

  /**
   * Sign in with Apple
   */
  const handleAppleSignIn = async () => {
    setError('');
    setIsAppleLoading(true);

    await runSocialSignIn(
      signInWithApple,
      'Failed to sign in with Apple',
      setError,
      setIsAppleLoading
    );
  };

  return {
    // State
    email,
    code,
    error,
    isSending,
    isVerifying,
    isGoogleLoading,
    isAppleLoading,
    isCodeSent: otpState?.codeSent ?? false,
    sentToEmail: otpState?.email,

    // Handlers
    setEmail,
    handleSendCode,
    handleCodeChange,
    handleKeyDown,
    handlePaste,
    handleResendCode,
    handleChangeEmail,
    handleGoogleSignIn,
    handleAppleSignIn,

    // Refs
    codeInputRefs,
  };
}
