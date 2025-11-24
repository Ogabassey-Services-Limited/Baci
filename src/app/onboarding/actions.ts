

'use server';

import { createClient } from '@/lib/supabase/server';
import { cookies } from 'next/headers';
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
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);
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

          // Step 1: Sign up the user with email confirmation disabled
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/auth/callback`,
            }
          });
          if (signUpError) {
            logger.error({ message: 'Sign up failed', error: signUpError });
            throw signUpError;
          }
          if (!signUpData.user) throw new Error('Sign up succeeded but no user object was returned.');

          // Check if we got a session from signUp
          if (signUpData.session) {
            user = signUpData.user;
            logger.info({ message: 'User signed up and logged in immediately', userId: user.id });
          } else {
            logger.warn({ message: 'User signed up but no session created (email confirmation may be required)', userId: signUpData.user.id });

            // Try to sign in anyway - this will fail if email confirmation is required
            const { data: newSignInData, error: newSignInError } = await supabase.auth.signInWithPassword({ email, password });
            if (newSignInError) {
              logger.error({ message: 'Sign in after sign up failed', error: newSignInError });
              throw new Error('Account created but email confirmation may be required. Please check your email and try logging in.');
            }
            user = newSignInData.user;
            logger.info({ message: 'User signed in successfully after sign up', userId: user?.id });
          }

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

    // Generate URL-safe slug from business name
    const generateSlug = (name: string): string => {
      return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
        .replace(/\s+/g, '-') // Replace spaces with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Trim hyphens from start/end
    };

    const baseSlug = generateSlug(businessName) || 'store';

    const merchantPayload = {
      user_id: user.id,
      email: email,
      business_name: businessName,
      business_type: finalBusinessType,
      logo_url: logoDataUri,
      brand_colors: { primary: brandColors.primary, background: brandColors.background, accent: brandColors.accent },
      slug: baseSlug,
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

    // 4. Create free subdomain domain record
    try {
      const rootDomain = process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'baci.tech';
      const subdomainFull = `${merchantData.slug}.${rootDomain}`;

      const { error: domainError } = await supabase.from('domains').insert({
        merchant_id: merchantData.id,
        domain: subdomainFull,
        tld: `.${rootDomain}`,
        domain_type: 'subdomain',
        status: 'active',
        is_primary: true,
        registered_at: new Date().toISOString(),
        ssl_status: 'active', // Assuming wildcard SSL for *.baci.tech
      });

      if (domainError) {
        logger.error({ message: 'Failed to create subdomain domain record', error: domainError });
        // Don't fail onboarding if domain record creation fails
      } else {
        logger.info({ message: 'Subdomain domain record created', domain: subdomainFull });
      }
    } catch (domainError) {
      logger.error({ message: 'Exception while creating subdomain', error: domainError });
      // Don't fail onboarding if domain creation fails
    }

    // 5. Generate and save initial Puck template
    try {
      const { generateInitialTemplate } = await import('@/lib/initial-template-generator');

      const initialPuckConfig = generateInitialTemplate({
        businessName,
        businessType: finalBusinessType,
        brandColors,
        merchant: merchantData
      });

      logger.info({ message: 'Generated initial Puck template', hasTheme: !!(initialPuckConfig as any).theme });

      // Save as both draft and published config
      const { error: configError } = await supabase.from('page_configs').insert({
        merchant_id: merchantData.id,
        page_slug: 'home',
        page_name: 'Home',
        draft_config: initialPuckConfig,
        published_config: initialPuckConfig,
        is_published: true
      });

      if (configError) {
        logger.error({ message: 'Failed to save initial Puck config', error: configError });
        // Don't fail onboarding if config save fails - it can be generated later
      } else {
        logger.info({ message: 'Initial Puck config saved successfully' });
      }
    } catch (templateError) {
      logger.error({ message: 'Failed to generate initial template', error: templateError });
      // Don't fail onboarding if template generation fails
    }

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
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
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
