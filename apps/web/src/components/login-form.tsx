'use client';

import { useActionState, useEffect, useState } from 'react';
import {
  type AuthActionState,
  forgotPasswordAction,
  loginAction,
  sendMerchantPasswordlessLoginAction,
  verifyMerchantPasswordlessLoginAction,
} from '@/app/actions/auth';
import { LoginFormShell } from '@/components/login-form-shell';
import type { LoginMode } from '@/components/login-form-types';
import { LoginPasswordEntry } from '@/components/login-password-entry';
import { LoginPasswordlessEntry } from '@/components/login-passwordless-entry';
import { LoginRecoveryEntry } from '@/components/login-recovery-entry';
import { LoginSocialOptions } from '@/components/login-social-options';
import { useToast } from '@/hooks/use-toast';
import { sanitizeRelativeRedirectPath } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/client';

const initialState: AuthActionState = { error: null, success: false };

type PasskeyError = {
  message: string;
};

type PasskeyAuth = {
  signInWithPasskey?: () => Promise<{
    error: PasskeyError | null;
  }>;
};

function getHeading(mode: LoginMode): string {
  switch (mode) {
    case 'forgot-password':
      return 'Reset Password';
    case 'passwordless-request':
      return 'Email Code';
    case 'passwordless-verify':
      return 'Verify Code';
    default:
      return 'Welcome back';
  }
}

function getSubheading(mode: LoginMode): string {
  switch (mode) {
    case 'forgot-password':
      return 'Enter your email to receive a reset link';
    case 'passwordless-request':
      return 'Enter your email to receive a sign-in code';
    case 'passwordless-verify':
      return 'Enter the six-digit code from your email';
    default:
      return 'Enter your credentials to access your store';
  }
}

type LoginFormProps = {
  defaultEmail: string;
  redirectTo: string;
};

export default function LoginForm({
  defaultEmail,
  redirectTo,
}: LoginFormProps) {
  const safeRedirectTo = sanitizeRelativeRedirectPath(redirectTo, '/dashboard');
  const [mode, setMode] = useState<LoginMode>('login');
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isAppleLoading, setIsAppleLoading] = useState(false);
  const [isPasskeyLoading, setIsPasskeyLoading] = useState(false);
  const [passwordlessEmail, setPasswordlessEmail] = useState(defaultEmail);

  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const supabase = createClient();
  const isPasskeyEnabled =
    process.env.NEXT_PUBLIC_SUPABASE_PASSKEY_AUTH_ENABLED === 'true';
  const isExternalAuthLoading =
    isGoogleLoading || isAppleLoading || isPasskeyLoading;

  const [loginState, loginFormAction] = useActionState(
    loginAction,
    initialState
  );

  const [forgotState, forgotFormAction] = useActionState(
    forgotPasswordAction,
    initialState
  );
  const [passwordlessSendState, passwordlessSendAction] = useActionState(
    sendMerchantPasswordlessLoginAction,
    initialState
  );
  const [passwordlessVerifyState, passwordlessVerifyAction] = useActionState(
    verifyMerchantPasswordlessLoginAction,
    initialState
  );

  useEffect(() => {
    if (loginState.error) {
      toast({
        variant: 'destructive',
        title: 'Sign-in Failed',
        description: loginState.error,
      });
    }
  }, [loginState.error, toast]);

  useEffect(() => {
    if (forgotState.success) {
      toast({
        title: 'Password Reset Email Sent',
        description:
          'Please check your email for a link to reset your password.',
      });
    } else if (forgotState.error) {
      toast({
        variant: 'destructive',
        title: 'Error Sending Reset Email',
        description: forgotState.error,
      });
    }
  }, [forgotState.success, forgotState.error, toast]);

  useEffect(() => {
    if (passwordlessSendState.success && passwordlessSendState.email) {
      setPasswordlessEmail(passwordlessSendState.email);
      setMode('passwordless-verify');
      toast({
        title: 'Code Sent',
        description: 'Please check your email for the six-digit sign-in code.',
      });
    } else if (passwordlessSendState.error) {
      toast({
        variant: 'destructive',
        title: 'Error Sending Code',
        description: passwordlessSendState.error,
      });
    }
  }, [
    passwordlessSendState.email,
    passwordlessSendState.error,
    passwordlessSendState.success,
    toast,
  ]);

  useEffect(() => {
    if (passwordlessVerifyState.error) {
      toast({
        variant: 'destructive',
        title: 'Code Verification Failed',
        description: passwordlessVerifyState.error,
      });
    }
  }, [passwordlessVerifyState.error, toast]);

  const [prevForgotState, setPrevForgotState] = useState(forgotState);
  if (forgotState !== prevForgotState) {
    setPrevForgotState(forgotState);
    if (forgotState.success) {
      setMode('login');
    }
  }

  const handleOAuthSignIn = async ({
    provider,
    label,
    setLoading,
  }: {
    provider: 'google' | 'apple';
    label: string;
    setLoading: (v: boolean) => void;
  }) => {
    setLoading(true);
    const failureTitle = `${label} Sign-in Failed`;
    const fallbackMessage = `Unable to start ${label} sign-in`;

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeRedirectTo)}`,
        },
      });

      if (!error) {
        return;
      }

      toast({
        variant: 'destructive',
        title: failureTitle,
        description: error.message,
      });
      setLoading(false);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: failureTitle,
        description: error instanceof Error ? error.message : fallbackMessage,
      });
      setLoading(false);
    }
  };

  const handleGoogleSignIn = () =>
    handleOAuthSignIn({
      provider: 'google',
      label: 'Google',
      setLoading: setIsGoogleLoading,
    });

  const handleAppleSignIn = () =>
    handleOAuthSignIn({
      provider: 'apple',
      label: 'Apple',
      setLoading: setIsAppleLoading,
    });

  const handlePasskeySignIn = async () => {
    setIsPasskeyLoading(true);
    try {
      const passkeyAuth = supabase.auth as typeof supabase.auth & PasskeyAuth;
      if (!passkeyAuth.signInWithPasskey) {
        throw new Error('Passkey sign-in is not available.');
      }

      const { error } = await passkeyAuth.signInWithPasskey();
      if (error) {
        throw new Error(error.message);
      }

      window.location.assign(safeRedirectTo);
    } catch (error) {
      toast({
        variant: 'destructive',
        title: 'Passkey Sign-in Failed',
        description:
          error instanceof Error
            ? error.message
            : 'Unable to complete passkey sign-in',
      });
      setIsPasskeyLoading(false);
    }
  };

  return (
    <LoginFormShell heading={getHeading(mode)} subheading={getSubheading(mode)}>
      {mode === 'login' ? (
        <>
          <LoginPasswordEntry
            action={loginFormAction}
            defaultEmail={defaultEmail}
            disabled={isExternalAuthLoading}
            onForgotPassword={() => setMode('forgot-password')}
            onPasswordlessRequest={() => {
              setPasswordlessEmail(defaultEmail);
              setMode('passwordless-request');
            }}
            onTogglePassword={() => setShowPassword(!showPassword)}
            redirectTo={safeRedirectTo}
            showPassword={showPassword}
          />
          <LoginSocialOptions
            disabled={isExternalAuthLoading}
            isAppleLoading={isAppleLoading}
            isGoogleLoading={isGoogleLoading}
            isPasskeyEnabled={isPasskeyEnabled}
            isPasskeyLoading={isPasskeyLoading}
            onAppleSignIn={handleAppleSignIn}
            onGoogleSignIn={handleGoogleSignIn}
            onPasskeySignIn={handlePasskeySignIn}
          />
        </>
      ) : mode === 'forgot-password' ? (
        <LoginRecoveryEntry
          action={forgotFormAction}
          onBackToLogin={() => setMode('login')}
        />
      ) : (
        <LoginPasswordlessEntry
          email={passwordlessEmail}
          mode={mode}
          onBackToLogin={() => setMode('login')}
          onUseDifferentEmail={() => setMode('passwordless-request')}
          redirectTo={safeRedirectTo}
          sendAction={passwordlessSendAction}
          sendState={passwordlessSendState}
          verifyAction={passwordlessVerifyAction}
          verifyState={passwordlessVerifyState}
        />
      )}
    </LoginFormShell>
  );
}
