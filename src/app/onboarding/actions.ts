
'use server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';
import type { BrandColors } from '@/ai/flows/guide-business-onboarding';

export type ServerActionState = {
  message: string;
  success: boolean;
  businessName?: string;
};

export async function submitOnboarding(
  prevState: ServerActionState,
  formData: FormData
): Promise<ServerActionState> {
  const supabase = createClient();
  let user: User | null = null;
  
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const businessName = formData.get('businessName') as string;
  const businessType = formData.get('businessType') as string;
  const otherBusinessType = formData.get('otherBusinessType') as string | undefined;
  const logoDataUri = formData.get('logoDataUri') as string | null;
  const brandColorsString = formData.get('brandColors') as string | null;
  
  const brandColors: BrandColors | null = brandColorsString ? JSON.parse(brandColorsString) : null;

  try {
    // 1. Create or sign in user
    // First, try to sign in the user. If they don't exist, Supabase will error,
    // and we can then proceed to sign them up.
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
        if (signInError.message.includes('Invalid login credentials')) {
            // User does not exist, so sign them up.
            const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
            if (signUpError) {
                // If sign-up also fails (e.g., weak password), throw the error.
                throw signUpError;
            }
            user = signUpData.user;
        } else {
            // Another sign-in error occurred.
            throw signInError;
        }
    } else {
        user = signInData.user;
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
      colors: { primary: brandColors.primary, secondary: brandColors.secondary, accent: brandColors.accent },
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
