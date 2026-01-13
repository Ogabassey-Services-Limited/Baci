import type { User } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { onboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';

// Import these dynamically in the function to avoid load-time issues,
// but for the route handler we can keep it simple or stick to dynamic if needed.
// Given the previous file used dynamic imports for these, we will too.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // --- 1. Validation ---
    // Adapting schema validation for JSON input instead of FormData
    const validationResult = await onboardingSchema.safeParseAsync(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          success: false,
          message: `Validation failed: ${validationResult.error.issues.map((e) => e.message).join(', ')}`,
          errors: validationResult.error.flatten(),
        },
        { status: 400 }
      );
    }

    const {
      email,
      password,
      businessName,
      businessType,
      otherBusinessType,
      logoUrl,
      slug: providedSlug,
      brandColors: brandColorsString,
    } = validationResult.data;

    // Parse brand colors
    let brandColors: BrandColors | null = null;
    if (brandColorsString) {
      try {
        brandColors = JSON.parse(brandColorsString);
      } catch (e) {
        console.error('Failed to parse brand colors', e);
      }
    }

    const adminSupabase = createAdminClient();
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // --- 2. User Creation / Auth ---
    // Mobile users are likely new.
    // We will try to sign up.

    let user: User | null = null;

    // Create user via SignUp
    // If user already exists, we will catch it below.
    // Actually, just try to Sign Up.

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp(
      {
        email,
        password: password || '', // Password is required for this flow
        options: {
          // No redirect for mobile, but email verification might still be on.
          // Assuming 'Confirm Email' is disabled or we handle it.
        },
      }
    );

    if (signUpError) {
      if (signUpError.message.includes('already registered')) {
        return NextResponse.json(
          { success: false, message: 'User already exists. Please log in.' },
          { status: 409 }
        );
      }
      throw signUpError;
    }

    if (signUpData.user) {
      user = signUpData.user;
    } else {
      return NextResponse.json(
        { success: false, message: 'Signup failed. Please try again.' },
        { status: 500 }
      );
    }

    // --- 3. Merchant & Domain Creation ---
    const finalBusinessType =
      businessType === 'other'
        ? otherBusinessType || businessType
        : businessType;

    // Use provided slug or generate from business name (first word only)
    const slug =
      providedSlug ||
      businessName
        .split(' ')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      'store';

    // Check for existing merchant
    const { data: existingMerchant } = await adminSupabase
      .from('merchants')
      .select('id, business_name')
      .eq('user_id', user.id)
      .maybeSingle();

    let merchant: { id: string; slug?: string } | null = null;

    if (existingMerchant) {
      // Update existing
      const { data: updatedMerchant, error: updateError } = await adminSupabase
        .from('merchants')
        .update({
          email,
          business_name: businessName,
          business_type: finalBusinessType,
          logo_url: logoUrl,
          favicon_png_192_url: logoUrl,
          brand_colors: brandColors,
          slug,
          template_id: 'puck', // Force Builder Engine for new merchants
        })
        .eq('id', existingMerchant.id)
        .select()
        .single();
      if (updateError) throw updateError;
      merchant = updatedMerchant;
    } else {
      // Create new
      const { data: newMerchant, error: createError } = await adminSupabase
        .from('merchants')
        .insert({
          user_id: user.id,
          email,
          business_name: businessName,
          business_type: finalBusinessType,
          logo_url: logoUrl,
          favicon_png_192_url: logoUrl,
          brand_colors: brandColors,
          slug,
        })
        .select()
        .single();
      if (createError) throw createError;
      merchant = newMerchant;
    }

    if (!merchant) throw new Error('Failed to create merchant');

    // Create Domain
    // Check if domain exists first? Unique constraint should handle it, but allow failure if we are updating.
    await adminSupabase
      .from('domains')
      .insert({
        merchant_id: merchant.id,
        domain: `${merchant.slug}.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'}`,
        tld: `.${process.env.NEXT_PUBLIC_ROOT_DOMAIN || 'usebaci.com'}`,
        domain_type: 'subdomain',
        status: 'active',
        is_primary: true,
      })
      .then(({ error }) => {
        if (error) console.log('Domain creation error (might exist):', error);
      });

    // --- 4. Template & Assets ---

    // Generate Template
    try {
      const { generateInitialTemplate } = await import(
        '@/lib/initial-template-generator'
      );
      const safeBrandColors = brandColors || {
        primary: '#000000',
        background: '#ffffff',
        accent: '#F59E0B',
      };
      const config = await generateInitialTemplate({
        businessName,
        businessType: finalBusinessType,
        brandColors: safeBrandColors,
        merchant: merchant as unknown as Record<string, unknown>,
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
      console.error('Template generation failed', e);
    }

    // Hero Images
    try {
      const { assignHeroImagesToMerchant } = await import(
        '@/services/hero-image-generator'
      );
      await assignHeroImagesToMerchant(
        merchant.id,
        finalBusinessType.toLowerCase(),
        false
      );
    } catch (e) {
      console.error('Hero image assignment failed', e);
    }

    // Email
    // TODO: Move welcome email to a webhook that listens for email_confirmed_at
    // sendWelcomeEmail(email, businessName).catch(console.error);

    return NextResponse.json({
      success: true,
      user,
      merchant,
      message: 'Account created successfully',
    });
  } catch (error: unknown) {
    console.error('Mobile onboarding error:', error);
    return NextResponse.json(
      {
        success: false,
        message: (error as Error).message || 'Internal Server Error',
      },
      { status: 500 }
    );
  }
}
