
'use server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';
import type { BrandColors } from '@/types';
import { onboardingSchema } from '@/schemas/onboarding';
import { z } from 'zod';

export type ServerActionState = {
  message: string;
  success: boolean;
  businessName?: string;
  errors?: {
    fieldErrors: Record<string, string[] | undefined>;
  }
};


export async function submitOnboarding(
  prevState: ServerActionState,
  formData: FormData
): Promise<ServerActionState> {
  const supabase = await createClient();
  let user: User | null = null;
  
  const rawFormData = Object.fromEntries(formData.entries());

  // Validate the form data on the server
  const validationResult = onboardingSchema.safeParse(rawFormData);

  if (!validationResult.success) {
    const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
    logger.error({ message: 'Server-side validation failed', errors: validationResult.error.flatten() });
    return { success: false, message: `Form is incomplete: ${errorMessage}`, errors: validationResult.error.flatten() };
  }

  const {
    email,
    password,
    businessName,
    businessType,
    otherBusinessType,
    logoDataUri,
    brandColors: brandColorsString,
  } = validationResult.data;

  const brandColors: BrandColors | null = brandColorsString ? JSON.parse(brandColorsString) : null;

  try {
    if (password) {
        // 1. Create or sign in user with password
        const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

        if (signInError) {
            if (signInError.message.toLowerCase().includes('email not confirmed')) {
                return { 
                    success: false, 
                    message: 'This email is already registered but not confirmed. Please check your inbox for a confirmation link. A new one has been sent.' 
                };
            }
            if (signInError.message.includes('Invalid login credentials')) {
                const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
                if (signUpError) throw signUpError;
                user = signUpData.user;
            } else {
                throw signInError;
            }
        } else {
            user = signInData.user;
        }
    } else {
        // Magic link flow: user should already be logged in
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
            user = session.user;
        }
    }


    if (!user) throw new Error("Authentication failed.");

    // 2. Save merchant data
    if (!logoDataUri || !brandColors) {
      throw new Error('Missing branding information. Please ensure a logo is processed.');
    }

    const finalBusinessType = businessType === 'other' ? (otherBusinessType || businessType) : businessType;

    const { error: merchantError } = await supabase.from('merchants').upsert({
      user_id: user.id,
      email: email,
      business_name: businessName,
      business_type: finalBusinessType,
      logo_url: logoDataUri,
      brand_colors: { primary: brandColors.primary, secondary: brandColors.secondary, accent: brandColors.accent },
    }, { onConflict: 'user_id' });

    if (merchantError) {
      throw new Error(`Failed to save merchant data: ${merchantError.message}`);
    }

    return { success: true, message: 'Store Created!', businessName };
  } catch (e) {
    logger.error({ message: "Onboarding submission failed.", error: e as Error });
    return { success: false, message: (e as Error).message };
  }
}

export async function sendMagicLink(email: string): Promise<{ success: boolean; message: string }> {
  if (!email) {
    return { success: false, message: 'Email is required.' };
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: `http://localhost:3000/onboarding?fromMagicLink=true`,
      },
    });

    if (error) {
      logger.error({ message: "Magic link sign-in failed.", error });
      return { success: false, message: error.message };
    }

    return { success: true, message: 'Magic link sent! Check your email.' };
  } catch (e) {
    logger.error({ message: "Magic link submission failed.", error: e as Error });
    return { success: false, message: (e as Error).message };
  }
}
