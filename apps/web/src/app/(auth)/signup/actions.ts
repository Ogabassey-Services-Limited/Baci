'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  buildAbsoluteAppRedirectUrl,
  sanitizeRelativeRedirectPath,
} from '@/lib/auth-redirect';
import { checkPasswordBreach } from '@/lib/password-breach';
import { asRoute } from '@/lib/routes';
import { createClient } from '@/lib/supabase/server';
import { signupSchema } from '@/schemas/auth';

export type SignupState = {
  message?: string;
  errors?: {
    fieldErrors?: Record<string, string[]>;
    formErrors?: string[];
  };
  success?: boolean;
};

export async function signupAction(
  _prevState: SignupState,
  formData: FormData
): Promise<SignupState> {
  // 1. Validate form data
  const validatedFields = signupSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
    confirmPassword: formData.get('confirmPassword'),
  });

  if (!validatedFields.success) {
    return {
      message: 'Invalid fields',
      errors: validatedFields.error.flatten(),
    };
  }

  const { email, password } = validatedFields.data;
  const redirectEntry = formData.get('redirectTo');
  const redirectTo = sanitizeRelativeRedirectPath(
    typeof redirectEntry === 'string' ? redirectEntry : null,
    '/dashboard'
  );

  // 1.5 Check if password is breached
  const { isBreached, count } = await checkPasswordBreach(password);

  if (isBreached) {
    return {
      message: 'Security Alert',
      errors: {
        fieldErrors: {
          password: [
            `This password has appeared in ${count?.toLocaleString()} known data breaches. Please choose a different, more secure password.`,
          ],
        },
      },
    };
  }

  // 2. Create Supabase client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 3. Sign up the user
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: buildAbsoluteAppRedirectUrl(redirectTo),
    },
  });

  if (error) {
    return {
      message: error.message,
    };
  }

  if (data.session) {
    revalidatePath('/', 'layout');
    // biome-ignore lint/suspicious/noExplicitAny: Next.js redirect needs Route type if typed routes are enabled
    redirect(redirectTo as any);
  }

  // 4. Revalidate and Redirect
  // Note: We don't create a merchant here. That's the key difference.
  revalidatePath('/', 'layout');
  redirect(
    asRoute(
      `/verify?email=${encodeURIComponent(email)}&redirect=${encodeURIComponent(redirectTo)}`
    )
  );
}
