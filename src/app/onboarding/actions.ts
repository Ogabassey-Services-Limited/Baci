
'use server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';
import type { BrandColors } from '@/types';
import { onboardingSchema } from '@/schemas/onboarding';

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
  logger.info({ message: 'submitOnboarding started', rawFormData });

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
  
  logger.info({ message: 'Form data validated successfully', data: validationResult.data });

  try {
    // 1. Handle user authentication and creation
    logger.info({ message: 'Checking for existing session...' });
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      user = session.user;
      logger.info({ message: 'User session found', userId: user.id });
    } else if (password) {
      logger.info({ message: 'No session, attempting to sign in with password...' });
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      
      if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
          logger.warn({ message: 'Sign in failed, attempting to sign up and then sign in.' });
          
          // Step 1: Sign up the user
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
          if (signUpError) {
             logger.error({ message: 'Sign up failed', error: signUpError });
             throw signUpError;
          }
          if (!signUpData.user) throw new Error('Sign up succeeded but no user object was returned.');
          logger.info({ message: 'User signed up successfully', userId: signUpData.user.id });

          // FIX: Explicitly sign in after sign up to create a session
          const { data: newSignInData, error: newSignInError } = await supabase.auth.signInWithPassword({ email, password });
          if (newSignInError) {
            logger.error({ message: 'Sign in after sign up failed', error: newSignInError });
            throw newSignInError;
          }
          user = newSignInData.user;
          logger.info({ message: 'User signed in successfully after sign up', userId: user?.id });

        } else {
          logger.error({ message: 'Sign in failed with an unexpected error', error: signInError });
          throw signInError;
        }
      } else {
        user = signInData.user;
        logger.info({ message: 'User signed in successfully', userId: user?.id });
      }
    }

    if (!user) {
        logger.error({ message: 'Authentication failed, user object is null.' });
        throw new Error("Authentication failed. Please try again.");
    }

    // 2. Ensure branding info exists
    if (!logoDataUri || !brandColors) {
      logger.error({ message: 'Branding information is missing', hasLogo: !!logoDataUri, hasColors: !!brandColors });
      throw new Error('Missing branding information. Please ensure a logo is processed.');
    }
    
    // 3. Create or update the merchant record
    const finalBusinessType = businessType === 'other' ? (otherBusinessType || businessType) : businessType;
    const merchantPayload = {
      user_id: user.id,
      email: email,
      business_name: businessName,
      business_type: finalBusinessType,
      logo_url: logoDataUri,
      brand_colors: { primary: brandColors.primary, secondary: brandColors.secondary, accent: brandColors.accent },
    };

    logger.info({ message: 'Attempting to upsert merchant data...', payload: merchantPayload });

    const { data: merchantData, error: merchantError } = await supabase.from('merchants').upsert(merchantPayload, { onConflict: 'user_id' }).select().single();

    if (merchantError) {
      logger.error({ message: 'Supabase upsert failed', error: merchantError });
      throw new Error(`Failed to save merchant data: ${merchantError.message}`);
    }
    
    if (!merchantData) {
        logger.error({ message: 'Upsert succeeded but returned no data.' });
        throw new Error('Failed to create or update merchant record.');
    }
    
    logger.info({ message: 'Merchant data saved successfully', merchantData });

    return { success: true, message: 'Store Created!', businessName };
  } catch (e) {
    const error = e as Error;
    logger.error({ message: "Onboarding submission failed.", error: { name: error.name, message: error.message, stack: error.stack } });
    return { success: false, message: error.message };
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
        emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL}/auth/callback?next=/onboarding?fromMagicLink=true`,
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
