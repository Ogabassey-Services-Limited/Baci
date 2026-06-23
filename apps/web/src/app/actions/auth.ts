'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sanitizeRelativeRedirectPath } from '@/lib/auth-redirect';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import {
  forgotPasswordSchema,
  loginSchema,
  merchantPasswordlessSendSchema,
  merchantPasswordlessVerifySchema,
} from '@/schemas/auth';

export type AuthActionState = {
  email?: string;
  error: string | null;
  success: boolean;
};

const GENERIC_LOGIN_ERROR = 'We could not sign you in with those credentials.';
const GENERIC_PASSWORDLESS_VERIFY_ERROR =
  'We could not verify that code. Please request a new one and try again.';

function getAppOrigin(): string {
  return (
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    'http://localhost:3000'
  );
}

function buildMerchantLoginRedirectUrl(redirectTo: string): string {
  const url = new URL('/auth/confirm', getAppOrigin());
  url.searchParams.set('next', redirectTo);
  return url.toString();
}

type NextRedirectTarget = Parameters<typeof redirect>[0];

function redirectToValidatedPath(path: string): never {
  redirect(path as NextRedirectTarget);
}

/**
 * Server action for email/password login
 * Works with useActionState for progressive enhancement
 */
// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: the login entry point itself; credentials verified by Supabase, Zod-validated + identity/IP rate limited
export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rateLimitAllowed = await ensureActionRateLimit('login', {
    requests: 10,
    windowMs: 60_000,
  });
  if (!rateLimitAllowed) {
    return {
      error: 'Too many login attempts. Please try again later.',
      success: false,
    };
  }

  const rawData = {
    email: formData.get('email'),
    password: formData.get('password'),
  };

  // Validate
  const result = loginSchema.safeParse(rawData);
  if (!result.success) {
    const firstError = result.error.issues[0]?.message || 'Invalid input';
    return { error: firstError, success: false };
  }

  const { email, password } = result.data;
  const redirectEntry = formData.get('redirectTo');
  const redirectTo = sanitizeRelativeRedirectPath(
    typeof redirectEntry === 'string' ? redirectEntry : null,
    '/dashboard'
  );

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return { error: GENERIC_LOGIN_ERROR, success: false };
    }
  } catch (e) {
    logger.warn({
      message: 'loginAction failed',
      error: e,
    });
    return {
      error: GENERIC_LOGIN_ERROR,
      success: false,
    };
  }

  // Redirect on success - this will throw and interrupt the response.
  redirectToValidatedPath(redirectTo);
}

/**
 * Server action for password reset request
 */
// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: pre-auth password reset; email Zod-validated + identity/IP rate limited
export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rateLimitAllowed = await ensureActionRateLimit('forgot-password', {
    requests: 3,
    windowMs: 900_000,
  });
  if (!rateLimitAllowed) {
    return {
      error: 'Too many password reset requests. Please try again later.',
      success: false,
    };
  }

  const email = formData.get('email');

  // Validate
  const result = forgotPasswordSchema.safeParse({ email });
  if (!result.success) {
    const firstError = result.error.issues[0]?.message || 'Invalid email';
    return { error: firstError, success: false };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get origin from request headers or use env variable
    const origin = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';

    const { error } = await supabase.auth.resetPasswordForEmail(
      result.data.email,
      {
        redirectTo: `${origin}/reset-password`,
      }
    );

    if (error) {
      logger.warn({
        message: 'forgotPasswordAction reset request failed',
        error,
      });
    }

    return { error: null, success: true };
  } catch (e) {
    logger.warn({
      message: 'forgotPasswordAction failed',
      error: e,
    });
    // Password reset is intentionally enumeration-safe: valid-looking emails
    // receive the same result whether Supabase sent a reset or not.
    return {
      error: null,
      success: true,
    };
  }
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: pre-auth merchant passwordless bootstrap; shouldCreateUser=false, email Zod-validated + identity/IP rate limited
export async function sendMerchantPasswordlessLoginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rateLimitAllowed = await ensureActionRateLimit(
    'merchant-passwordless-login',
    {
      requests: 3,
      windowMs: 60_000,
    }
  );
  if (!rateLimitAllowed) {
    return {
      error: 'Too many sign-in requests. Please try again later.',
      success: false,
    };
  }

  const redirectEntry = formData.get('redirectTo');
  const redirectTo = sanitizeRelativeRedirectPath(
    typeof redirectEntry === 'string' ? redirectEntry : null,
    '/dashboard'
  );
  const validationResult = merchantPasswordlessSendSchema.safeParse({
    email: formData.get('email'),
    redirectTo,
  });
  if (!validationResult.success) {
    return {
      error:
        validationResult.error.issues[0]?.message ||
        'Please enter a valid email address.',
      success: false,
    };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.signInWithOtp({
      email: validationResult.data.email,
      options: {
        shouldCreateUser: false,
        emailRedirectTo: buildMerchantLoginRedirectUrl(redirectTo),
      },
    });

    if (error) {
      logger.warn({
        message: 'Merchant passwordless login send failed',
        error,
      });
    }
  } catch (error) {
    logger.warn({
      message: 'Merchant passwordless login send threw',
      error,
    });
  }

  return {
    email: validationResult.data.email,
    error: null,
    success: true,
  };
}

// eslint-disable-next-line react-doctor/server-auth-actions -- public-by-design: pre-auth merchant passwordless verification; Supabase validates the OTP and sets the SSR session cookie
export async function verifyMerchantPasswordlessLoginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const rateLimitAllowed = await ensureActionRateLimit(
    'merchant-passwordless-verify',
    {
      requests: 5,
      windowMs: 60_000,
    }
  );
  if (!rateLimitAllowed) {
    return {
      error: 'Too many verification attempts. Please try again later.',
      success: false,
    };
  }

  const redirectEntry = formData.get('redirectTo');
  const emailEntry = formData.get('email');
  const redirectTo = sanitizeRelativeRedirectPath(
    typeof redirectEntry === 'string' ? redirectEntry : null,
    '/dashboard'
  );
  const validationResult = merchantPasswordlessVerifySchema.safeParse({
    email: formData.get('email'),
    redirectTo,
    token: formData.get('token'),
  });
  if (!validationResult.success) {
    return {
      email: typeof emailEntry === 'string' ? emailEntry : undefined,
      error:
        validationResult.error.issues[0]?.message ||
        GENERIC_PASSWORDLESS_VERIFY_ERROR,
      success: false,
    };
  }

  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.verifyOtp({
      email: validationResult.data.email,
      token: validationResult.data.token,
      type: 'email',
    });

    if (error) {
      logger.warn({
        message: 'Merchant passwordless verify failed',
        error,
      });
      return {
        email: validationResult.data.email,
        error: GENERIC_PASSWORDLESS_VERIFY_ERROR,
        success: false,
      };
    }
  } catch (error) {
    logger.warn({
      message: 'Merchant passwordless verify threw',
      error,
    });
    return {
      email: validationResult.data.email,
      error: GENERIC_PASSWORDLESS_VERIFY_ERROR,
      success: false,
    };
  }

  redirectToValidatedPath(redirectTo);
}
