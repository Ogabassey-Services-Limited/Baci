/**
 * useSignInForm Hook
 *
 * 2026 Best Practices:
 * - Separation of concerns (logic from UI)
 * - React Hook Form for form management
 * - Zod for validation (manual validation to avoid v4 resolver issues)
 * - Type-safe return values
 * - Testable business logic
 */

import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { useForm } from 'react-hook-form';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/stores/auth-store';
import type { SignInFormData, UseSignInFormReturn } from '../types';
import {
  getUserFriendlyError,
  SOCIAL_ERROR_MESSAGES,
} from '../utils';
import { signInSchema } from '../utils/validation';
import { useHapticFeedback } from './useHapticFeedback';

interface UseSignInFormOptions {
  onSuccess: () => void;
}

/**
 * Custom hook for sign-in form logic
 *
 * Handles:
 * - Form state and validation (via React Hook Form + Zod)
 * - Email/password authentication
 * - Social sign-in (Google, Apple)
 * - Error handling and user feedback
 * - Haptic feedback
 */
export function useSignInForm({ onSuccess }: UseSignInFormOptions): UseSignInFormReturn {
  const { triggerHaptic } = useHapticFeedback();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pendingSocialSignInRef = useRef(false);

  // Auth store methods
  const user = useAuthStore((state) => state.user);
  const signInWithGoogle = useAuthStore((state) => state.signInWithGoogle);
  const signInWithApple = useAuthStore((state) => state.signInWithApple);

  // React Hook Form with manual validation
  const {
    control,
    handleSubmit,
    formState: { errors },
    setValue,
    setError: setFormError,
  } = useForm<SignInFormData>({
    defaultValues: {
      email: '',
      password: '',
    },
    mode: 'onBlur',
  });

  /**
   * Clear the current error state
   */
  const clearError = () => {
    if (error) setError(null);
  };

  useEffect(() => {
    if (!pendingSocialSignInRef.current || !user) {
      return;
    }

    pendingSocialSignInRef.current = false;
    setIsLoading(false);
    triggerHaptic('success');
    onSuccess();
    router.replace('/checkout');
  }, [onSuccess, triggerHaptic, user]);

  /**
   * Validate form data with Zod and set field errors
   */
  const validateForm = (data: SignInFormData): boolean => {
    const result = signInSchema.safeParse(data);

    if (!result.success) {
      // Set field-level errors from Zod
      result.error.issues.forEach((issue) => {
        const field = issue.path[0] as keyof SignInFormData;
        if (field) {
          setFormError(field, { message: issue.message });
        }
      });
      triggerHaptic('warning');
      return false;
    }

    return true;
  };

  /**
   * Handle email/password sign-in
   */
  const handleSignIn = handleSubmit(async (data) => {
    // Validate with Zod
    if (!validateForm(data)) {
      return;
    }

    triggerHaptic('light');
    setIsLoading(true);
    setError(null);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: data.email.trim().toLowerCase(),
        password: data.password,
      });

      if (loginError) throw loginError;

      triggerHaptic('success');
      onSuccess();
      router.push('/checkout');
    } catch (err) {
      const friendlyError = getUserFriendlyError(err);
      setError(friendlyError);
      triggerHaptic('error');

      // Announce error to screen readers
      AccessibilityInfo.announceForAccessibility(friendlyError);
    } finally {
      setIsLoading(false);
    }
  });

  /**
   * Handle Google OAuth sign-in
   */
  const handleGoogleSignIn = async () => {
    triggerHaptic('light');
    setIsLoading(true);
    setError(null);
    pendingSocialSignInRef.current = true;

    try {
      const result = await signInWithGoogle();

      if (!result.success) {
        pendingSocialSignInRef.current = false;
        setIsLoading(false);
      }

      if (
        !result.success &&
        result.error &&
        result.error !== SOCIAL_ERROR_MESSAGES.cancelled
      ) {
        setError(result.error);
        triggerHaptic('error');
      }
    } catch {
      pendingSocialSignInRef.current = false;
      setError(SOCIAL_ERROR_MESSAGES.google);
      triggerHaptic('error');
      setIsLoading(false);
    }
  };

  /**
   * Handle Apple OAuth sign-in
   */
  const handleAppleSignIn = async () => {
    triggerHaptic('light');
    setIsLoading(true);
    setError(null);
    pendingSocialSignInRef.current = true;

    try {
      const result = await signInWithApple();

      if (!result.success) {
        pendingSocialSignInRef.current = false;
        setIsLoading(false);
      }

      if (
        !result.success &&
        result.error &&
        result.error !== SOCIAL_ERROR_MESSAGES.cancelled
      ) {
        setError(result.error);
        triggerHaptic('error');
      }
    } catch {
      pendingSocialSignInRef.current = false;
      setError(SOCIAL_ERROR_MESSAGES.apple);
      triggerHaptic('error');
      setIsLoading(false);
    }
  };

  /**
   * Navigate to forgot password screen
   */
  const handleForgotPassword = () => {
    triggerHaptic('light');
    router.push('/auth/login?mode=forgot');
  };

  return {
    // Form control
    control,
    errors,
    setValue,

    // State
    isLoading,
    error,

    // Handlers
    handleSignIn,
    handleGoogleSignIn,
    handleAppleSignIn,
    handleForgotPassword,
    clearError,
  };
}
