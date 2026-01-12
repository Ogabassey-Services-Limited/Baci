'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
  const _redirectTo = (formData.get('redirectTo') as string) || '/dashboard';

  // 2. Create Supabase client
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // 3. Sign up the user
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_ROOT_DOMAIN}/auth/callback`,
    },
  });

  if (error) {
    return {
      message: error.message,
    };
  }

  // 4. Revalidate and Redirect
  // Note: We don't create a merchant here. That's the key difference.
  revalidatePath('/', 'layout');
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}
