
'use server';

import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logger';
import type { User } from '@supabase/supabase-js';
import type { BrandColors } from '@/ai/flows/guide-business-onboarding';
import { z } from 'zod';
import { checkPasswordStrength } from '@/components/password-strength-indicator';

export type ServerActionState = {
  message: string;
  success: boolean;
  businessName?: string;
};

// --- Zod Schema Definitions ---
const onboardingSchema = z.object({
  email: z.string().email('Please enter a valid email address.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  confirmPassword: z.string().optional(),
  businessName: z.string().min(2, 'Business name must be at least 2 characters.'),
  businessType: z.string().min(1, 'Please select a business type.'),
  otherBusinessType: z.string().optional(),
  logoDataUri: z.string().min(1, 'Please upload or generate a logo.'),
  brandColors: z.string().min(1, 'Brand colors are required.'),
})
.refine(data => {
    if (data.businessType === 'other' && (!data.otherBusinessType || data.otherBusinessType.length < 2)) {
      return false;
    }
    return true;
  }, {
    message: "If you select 'Other', please specify your business type.",
    path: ["otherBusinessType"],
})
.refine(data => {
    if (checkPasswordStrength(data.password || '') >= 3) {
        return data.password === data.confirmPassword;
    }
    return true;
}, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
});


export async function submitOnboarding(
  prevState: ServerActionState,
  formData: FormData
): Promise<ServerActionState> {
  const supabase = createClient();
  let user: User | null = null;
  
  const rawFormData = Object.fromEntries(formData.entries());

  // Validate the form data on the server
  const validationResult = onboardingSchema.safeParse(rawFormData);

  if (!validationResult.success) {
    const errorMessage = validationResult.error.errors.map(e => e.message).join(', ');
    logger.error({ message: 'Server-side validation failed', errors: validationResult.error.flatten() });
    return { success: false, message: `Form is incomplete: ${errorMessage}` };
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
    // 1. Create or sign in user
    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
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
