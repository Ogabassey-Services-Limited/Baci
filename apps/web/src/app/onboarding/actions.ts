'use server';

import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getAppUrl, getRootDomain } from '@/env';
import { sendWelcomeEmail } from '@/lib/email';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';
import { onboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';

export type ServerActionState = {
  message: string;
  success: boolean;
  businessName?: string;
  merchantId?: string;
  errors?: {
    fieldErrors: Record<string, string[] | undefined>;
  };
};

function buildOnboardingRedirectUrl(search: string = ''): string {
  const url = new URL('/onboarding', getAppUrl());
  url.search = search;
  return url.toString();
}

export async function submitOnboarding(
  _prevState: ServerActionState,
  formData: FormData
): Promise<ServerActionState> {
  const cookieStore = await cookies();
  const supabase = createClient(cookieStore);

  // Admin client for database inserts (Bypasses RLS)
  const { createAdminClient } = await import('@/lib/supabase/admin');
  const adminSupabase = createAdminClient();

  let user: User | null = null;
  const rawFormData = Object.fromEntries(formData.entries());
  logger.info({ message: 'submitOnboarding started' });

  // Validation
  const validationResult = await onboardingSchema.safeParseAsync(rawFormData);
  if (!validationResult.success) {
    return {
      success: false,
      message: `Form is incomplete: ${validationResult.error.issues.map((e) => e.message).join(', ')}`,
      errors: validationResult.error.flatten(),
    };
  }

  const {
    email,
    password,
    businessName,
    businessType,
    otherBusinessType,
    logoUrl,
    brandColors: brandColorsString,
  } = validationResult.data;

  let brandColors: BrandColors | null = null;
  if (brandColorsString) {
    try {
      brandColors = JSON.parse(brandColorsString);
    } catch (e) {
      logger.error({ message: 'Failed to parse brand colors', error: e });
    }
  }

  try {
    // PRE-CHECK: Only block if email has a COMPLETED merchant (with business_name set)
    const { data: existingMerchant } = await adminSupabase
      .from('merchants')
      .select('id, business_name')
      .eq('email', email)
      .maybeSingle();

    if (existingMerchant?.business_name) {
      return {
        success: false,
        message:
          'An account with this email already exists. Please log in instead.',
      };
    }

    // 1. Auth Check (Using standard client)
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const onboardingRedirectUrl = buildOnboardingRedirectUrl();

    if (authUser) {
      // Check if form email matches session email
      if (authUser.email?.toLowerCase() === email.toLowerCase()) {
        // Same email - use existing session
        user = authUser;
      } else if (password) {
        // Different email with password provided - sign out old session and create new account
        await supabase.auth.signOut();

        // Try to sign up with the new email
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: onboardingRedirectUrl,
            },
          });

        if (signUpError) throw signUpError;

        if (signUpData.session) {
          user = signUpData.user;
          sendWelcomeEmail(email, businessName || 'Valued Merchant').catch(
            (err) =>
              logger.error({
                message: 'Failed to send welcome email',
                email,
                error: err,
              })
          );
        } else {
          throw new Error(
            'Please disable "Confirm Email" in Supabase settings.'
          );
        }
      } else {
        // Different email but no password - ask user to provide password
        return {
          success: false,
          message: `You are logged in as ${authUser.email}. Please log out first, or enter a password to create a new account with ${email}.`,
        };
      }
    } else if (password) {
      // No session - try SignIn then SignUp
      const { data: signInData, error: signInError } =
        await supabase.auth.signInWithPassword({ email, password });

      if (!signInError) {
        user = signInData.user;
      } else if (signInError.message.includes('Invalid login credentials')) {
        // SignUp
        const { data: signUpData, error: signUpError } =
          await supabase.auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: onboardingRedirectUrl,
            },
          });

        if (signUpError) throw signUpError;

        if (signUpData.session) {
          user = signUpData.user;
          sendWelcomeEmail(email, businessName || 'Valued Merchant').catch(
            (err) =>
              logger.error({
                message: 'Failed to send welcome email',
                email,
                error: err,
              })
          );
        } else {
          throw new Error(
            'Please disable "Confirm Email" in Supabase settings.'
          );
        }
      } else {
        throw signInError;
      }
    }

    if (!user) throw new Error('Authentication failed.');

    // 2. Insert Data (Using ADMIN CLIENT)
    const finalBusinessType =
      businessType === 'other'
        ? otherBusinessType || businessType
        : businessType;
    const slug =
      businessName
        .split(' ')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') || 'store';

    // Check for existing merchant record
    const { data: existing } = await adminSupabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .maybeSingle();

    let merchant: { id: string; slug?: string } | null;

    if (existing) {
      if (existing.business_name) {
        // Merchant already fully set up - redirect to dashboard
        return {
          success: true,
          message: 'Welcome back! Redirecting to your dashboard...',
          businessName: existing.business_name,
          merchantId: existing.id,
        };
      }

      // Incomplete merchant (from auto-trigger) - UPDATE with form data
      const { data: updatedMerchant, error: updateError } = await adminSupabase
        .from('merchants')
        .update({
          email,
          business_name: businessName,
          business_type: finalBusinessType,
          logo_url: logoUrl,
          // Sync logo to favicon for mobile app compatibility
          favicon_png_192_url: logoUrl,
          brand_colors: brandColors,
          slug,
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError)
        throw new Error(`Failed to update merchant: ${updateError.message}`);
      merchant = updatedMerchant;
    } else {
      // No existing record - create new merchant
      const { data: newMerchant, error: createError } = await adminSupabase
        .from('merchants')
        .insert({
          user_id: user.id,
          email,
          business_name: businessName,
          business_type: finalBusinessType,
          logo_url: logoUrl,
          // Sync logo to favicon for mobile app compatibility
          favicon_png_192_url: logoUrl,
          brand_colors: brandColors,
          slug,
          template_id: 'puck', // Force Builder Engine for new merchants
          signup_source: 'web',
        })
        .select()
        .single();

      if (createError)
        throw new Error(`Merchant creation failed: ${createError.message}`);
      merchant = newMerchant;
    }

    if (!merchant) throw new Error('Failed to create merchant record.');

    const rootDomain = getRootDomain() || 'usebaci.com';

    // Create Domain
    const { error: domainError } = await adminSupabase.from('domains').insert({
      merchant_id: merchant.id,
      domain: `${merchant.slug}.${rootDomain}`,
      tld: `.${rootDomain}`,
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });

    if (domainError) {
      throw new Error(`Failed to create domain: ${domainError.message}`);
    }

    // Generate Template (simplified for brevity, import remains same)
    try {
      const { generateInitialTemplate } = await import(
        '@/lib/initial-template-generator'
      );
      // Ensure brandColors is never null by providing defaults
      const safeBrandColors = brandColors || {
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B', // Default amber/yellow accent
      };
      const config = await generateInitialTemplate({
        businessName,
        businessType: finalBusinessType,
        brandColors: safeBrandColors,
        merchant,
      });
      await adminSupabase.from('page_configs').insert({
        merchant_id: merchant.id,
        page_slug: 'home',
        page_name: 'Home',
        draft_config: config,
        published_config: config,
        is_published: true,
      });
    } catch (e) {
      logger.error({
        message: 'Template generation failed',
        merchantId: merchant.id,
        error: e,
      });
    }

    // Assign Hero Images
    try {
      const { assignHeroImagesToMerchant } = await import(
        '@/services/hero-image-generator'
      );
      // Pass false to skip synchronous generation - instant feedback for user
      await assignHeroImagesToMerchant(
        merchant.id,
        finalBusinessType.toLowerCase(),
        false
      );
    } catch (e) {
      logger.error({
        message: 'Hero image assignment failed',
        merchantId: merchant.id,
        error: e,
      });
    }

    return {
      success: true,
      message: 'Store created!',
      businessName,
      merchantId: merchant.id,
    };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}

export async function sendMagicLink(
  email: string
): Promise<{ success: boolean; message: string }> {
  if (!email) return { success: false, message: 'Email is required.' };
  try {
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: buildOnboardingRedirectUrl('fromMagicLink=true'),
      },
    });
    if (error) throw error;
    return { success: true, message: 'Magic link sent! Check your email.' };
  } catch (e) {
    return { success: false, message: (e as Error).message };
  }
}
