'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import z from 'zod';
import { sanitizeRelativeRedirectPath } from '@/lib/auth-redirect';
import { createClient } from '@/lib/supabase/server';

export type AuthActionState = {
  error: string | null;
  success: boolean;
};

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
});

/**
 * Server action for email/password login
 * Works with useActionState for progressive enhancement
 */
export async function loginAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
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
export async function forgotPasswordAction(
  _prevState: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
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
