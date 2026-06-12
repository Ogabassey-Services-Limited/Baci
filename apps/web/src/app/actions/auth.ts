'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { sanitizeRelativeRedirectPath } from '@/lib/auth-redirect';
import { ensureActionRateLimit } from '@/lib/ensure-action-rate-limit';
import { createClient } from '@/lib/supabase/server';
import { forgotPasswordSchema, loginSchema } from '@/schemas/auth';

export type AuthActionState = {
  error: string | null;
  success: boolean;
};

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
      return { error: error.message, success: false };
    }
  } catch (e) {
    const error = e as Error;
    return {
      error: error.message || 'An unexpected error occurred',
      success: false,
    };
  }

  // Redirect on success - this will throw and interrupt the response
  // biome-ignore lint/suspicious/noExplicitAny: Next.js redirect needs Route type if typed routes are enabled
  redirect(redirectTo as any);
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
      return { error: error.message, success: false };
    }

    return { error: null, success: true };
  } catch (e) {
    const error = e as Error;
    return {
      error: error.message || 'An unexpected error occurred',
      success: false,
    };
  }
}
