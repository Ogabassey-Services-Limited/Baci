/**
 * SignInForm Component
 *
 * 2026 Best Practices:
 * - Modular architecture with separated concerns
 * - React Hook Form + Zod for form handling
 * - Custom hook for business logic
 * - Composable UI components
 * - Full accessibility support
 */

import React, { useRef } from 'react';
import type { TextInput } from 'react-native';
import { useSignInForm } from '../hooks';
import type { SignInFormProps } from '../types';
import { EmailInput } from './EmailInput';
import { ErrorAlert } from './ErrorAlert';
import { PasswordInput } from './PasswordInput';
import { SocialSignInButtons } from './SocialSignInButtons';
import { SubmitButton } from './SubmitButton';

/**
 * Sign-in form with email/password and social authentication
 *
 * Composed of modular sub-components:
 * - ErrorAlert: Error message display
 * - EmailInput: Email input with validation
 * - PasswordInput: Password input with visibility toggle
 * - SubmitButton: Primary action button
 * - SocialSignInButtons: Google/Apple sign-in
 */
export function SignInForm({ onSuccess }: SignInFormProps) {
  const passwordInputRef = useRef<TextInput>(null);
  const {
    control,
    errors,
    isLoading,
    error,
    handleSignIn,
    handleGoogleSignIn,
    handleAppleSignIn,
    handleForgotPassword,
    clearError,
  } = useSignInForm({ onSuccess });

  return (
    <>
      {/* Error Message */}
      <ErrorAlert error={error} />

      {/* Email Input */}
      <EmailInput
        control={control}
        errors={errors}
        isLoading={isLoading}
        onClearError={clearError}
        returnKeyType="next"
        onSubmitEditing={() => passwordInputRef.current?.focus()}
      />

      {/* Password Input */}
      <PasswordInput
        control={control}
        errors={errors}
        isLoading={isLoading}
        onClearError={clearError}
        onForgotPassword={handleForgotPassword}
        inputRef={passwordInputRef}
        returnKeyType="go"
        onSubmitEditing={handleSignIn}
      />

      {/* Submit Button */}
      <SubmitButton isLoading={isLoading} onPress={handleSignIn} />

      {/* Social Sign-In */}
      <SocialSignInButtons
        isLoading={isLoading}
        onGoogleSignIn={handleGoogleSignIn}
        onAppleSignIn={handleAppleSignIn}
      />
    </>
  );
}
