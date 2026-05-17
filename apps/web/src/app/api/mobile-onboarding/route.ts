import {
  createClient as createSupabaseClient,
  type User,
} from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { env, getSupabaseAnonKey, getSupabaseUrl } from '@/env';
import { checkPasswordBreach } from '@/lib/password-breach';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { mobileOnboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';

// Allow up to 60s — template generation calls an AI model (Gemini)
// and hero-image assignment can also be slow. The default 10s is not enough.
export const maxDuration = 60;

type SlugResolverClient = {
  rpc: (
    fn: string,
    params: { text_input: string }
  ) => Promise<{ data: unknown; error: { message?: string } | null }>;
};

function hasEstablishedMerchantSlug(slug: string | null | undefined): boolean {
  return typeof slug === 'string' && slug.trim().length > 0;
}

async function resolveMerchantSlug(
  supabase: SlugResolverClient,
  textInput: string,
  fallbackSlug: string
): Promise<string> {
  const { data, error } = await supabase.rpc('generate_slug', {
    text_input: textInput,
  });

  if (error) {
    console.warn(
      'Failed to generate unique merchant slug for mobile onboarding',
      {
        error,
        fallbackSlug,
        textInput,
      }
    );
    return fallbackSlug;
  }

  return typeof data === 'string' && data.trim() ? data : fallbackSlug;
}

// CSRF exempt: This endpoint is called exclusively by the mobile app (Expo/React Native)
// which sends Authorization Bearer tokens, not browser cookies. CSRF is a browser-specific
// attack vector that exploits automatic cookie sending — mobile apps are not vulnerable.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // --- 1. Validation ---
    const validationResult = await mobileOnboardingSchema.safeParseAsync(body);

    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: `Validation failed: ${validationResult.error.issues.map((e) => e.message).join(', ')}`,
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
      firstName,
      lastName,
      phone,
    } = validationResult.data;

    // Combine first and last name for Supabase user metadata
    const fullName =
      [firstName, lastName].filter(Boolean).join(' ') || undefined;

    // Parse brand colors
    let brandColors: BrandColors | null = null;
    if (brandColorsString) {
      try {
        brandColors = JSON.parse(brandColorsString);
      } catch {
        console.error('Failed to parse brand colors from request body');
      }
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    let scopedSupabase = supabase;

    // --- 2. User Creation / Auth ---

    // Check if request is authenticated (Bearer token or Cookie)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    let user: User | null = currentUser;

    // If no authenticated user, try to Sign Up
    if (!user) {
      if (!password) {
        return NextResponse.json(
          { error: 'Password is required for new accounts.' },
          { status: 400 }
        );
      }

      try {
        const { isBreached, count } = await checkPasswordBreach(password);

        if (isBreached) {
          return NextResponse.json(
            {
              error: `This password has appeared in ${(count ?? 1).toLocaleString()} known data breaches. Please choose a different, more secure password.`,
            },
            { status: 400 }
          );
        }
      } catch (breachCheckError) {
        // Fail-open: allow signup if breach check is unavailable
        console.error(
          'Password breach check failed, proceeding with signup:',
          breachCheckError
        );
      }

      const { data: signUpData, error: signUpError } =
        await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

      if (signUpError) {
        if (signUpError.message.includes('already registered')) {
          return NextResponse.json(
            { error: 'User already exists. Please log in.' },
            { status: 409 }
          );
        }
        if (
          signUpError.status === 429 ||
          signUpError.message.includes('security purposes')
        ) {
          return NextResponse.json(
            { error: 'Too many attempts. Please wait a minute and try again.' },
            { status: 429 }
          );
        }
        throw signUpError;
      }

      if (!signUpData.user) {
        return NextResponse.json(
          { error: 'Signup failed. Please try again.' },
          { status: 500 }
        );
      }
      user = signUpData.user;

      if (signUpData.session?.access_token) {
        // NOTE: We must construct a raw client here because the new user has
        // no cookie session yet. We inject their access_token as a Bearer
        // header so subsequent DB operations run under their RLS identity.
        scopedSupabase = createSupabaseClient(
          getSupabaseUrl(),
          getSupabaseAnonKey(),
          {
            auth: {
              persistSession: false,
              autoRefreshToken: false,
              detectSessionInUrl: false,
            },
            global: {
              headers: {
                Authorization: `Bearer ${signUpData.session.access_token}`,
              },
            },
          }
        );
      } else {
        return NextResponse.json(
          {
            error:
              'Please confirm your email to finish onboarding and sign in again.',
            code: 'EMAIL_CONFIRMATION_REQUIRED',
          },
          { status: 403 }
        );
      }
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
    const userAgent = req.headers.get('user-agent')?.toLowerCase() ?? '';
    const signupSource =
      userAgent.includes('iphone') ||
      userAgent.includes('ipad') ||
      userAgent.includes('ios')
        ? ('ios' as const)
        : ('android' as const);

    // Check for existing merchant
    const { data: existingMerchant, error: lookupError } = await scopedSupabase
      .from('merchants')
      .select('id, business_name, slug')
      .eq('user_id', user.id)
      .maybeSingle();

    if (lookupError) {
      console.error('Merchant lookup failed:', lookupError);
      return NextResponse.json(
        { error: 'Failed to check existing account.' },
        { status: 500 }
      );
    }

    let merchantId: string;
    let merchantSlug: string;

    if (existingMerchant) {
      const resolvedSlug = hasEstablishedMerchantSlug(existingMerchant.slug)
        ? null
        : await resolveMerchantSlug(scopedSupabase, slug, slug);

      const merchantUpdate = {
        email,
        business_name: businessName,
        business_type: finalBusinessType,
        logo_url: logoUrl,
        favicon_png_192_url: logoUrl,
        brand_colors: brandColors,
        template_id: 'puck',
        ...(resolvedSlug ? { slug: resolvedSlug } : {}),
        ...(!existingMerchant.business_name?.trim()
          ? { signup_source: signupSource }
          : {}),
      };

      // Update existing
      const { data: updatedMerchant, error: updateError } = await scopedSupabase
        .from('merchants')
        .update(merchantUpdate)
        .eq('id', existingMerchant.id)
        .select('id, slug')
        .single();
      if (updateError) throw updateError;
      merchantId = updatedMerchant.id;
      merchantSlug = updatedMerchant.slug;
    } else {
      // Create new
      const { data: newMerchant, error: createError } = await scopedSupabase
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
          template_id: 'puck',
          signup_source: signupSource,
        })
        .select('id, slug')
        .single();
      if (createError) throw createError;
      merchantId = newMerchant.id;
      merchantSlug = newMerchant.slug;
    }

    // Create Domain
    const { error: domainError } = await scopedSupabase.from('domains').insert({
      merchant_id: merchantId,
      domain: `${merchantSlug}.${env.NEXT_PUBLIC_ROOT_DOMAIN}`,
      tld: `.${env.NEXT_PUBLIC_ROOT_DOMAIN}`,
      domain_type: 'subdomain',
      status: 'active',
      is_primary: true,
    });

    if (domainError && domainError.code !== '23505') {
      console.error(
        'Domain creation failed for merchant',
        merchantId,
        domainError
      );
      return NextResponse.json(
        { error: 'Failed to provision store domain. Please try again.' },
        { status: 500 }
      );
    }

    // Upsert Staff Member (Profile Data)
    const { error: staffError } = await scopedSupabase
      .from('staff_members')
      .upsert(
        {
          user_id: user.id,
          merchant_id: merchantId,
          name: fullName || null,
          phone: phone || null,
          email: user.email || email,
          role: 'owner',
          status: 'active',
        },
        { onConflict: 'user_id, merchant_id' }
      );
    if (staffError) {
      console.error('Failed to create/update staff member profile', staffError);
    }

    // --- 4. Template & Assets (deferred via after()) ---
    // These are slow operations (AI model call for template + image assignment)
    // that must NOT block the registration response. after() runs them after
    // the response is sent while keeping the function alive on Vercel.
    after(async () => {
      // Use admin client for background writes — the scoped client's Bearer
      // token may expire, and after() runs outside the original auth context.
      const adminSupabase = createAdminClient();

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
          merchant: { id: merchantId, slug: merchantSlug },
        });
        const { error: pageConfigError } = await adminSupabase
          .from('page_configs')
          .insert({
            merchant_id: merchantId,
            page_slug: 'home',
            page_name: 'Home',
            draft_config: config,
            published_config: config,
            is_published: true,
          });
        if (pageConfigError) {
          console.error(
            'Failed to insert page config for merchant',
            merchantId,
            pageConfigError
          );
        }
      } catch (e) {
        console.error('Template generation failed for merchant', merchantId, e);
      }

      // Hero Images
      try {
        const { assignHeroImagesToMerchant } = await import(
          '@/services/hero-image-generator'
        );
        await assignHeroImagesToMerchant(
          merchantId,
          finalBusinessType.toLowerCase(),
          false
        );
      } catch (e) {
        console.error(
          'Hero image assignment failed for merchant',
          merchantId,
          e
        );
      }
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, email: user.email ?? email },
      merchant: { id: merchantId, slug: merchantSlug },
      message: 'Account created successfully',
    });
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    const errName = error instanceof Error ? error.name : typeof error;
    const errStack =
      error instanceof Error
        ? error.stack?.split('\n').slice(0, 3).join(' | ')
        : undefined;
    console.error(
      'Mobile onboarding error:',
      JSON.stringify({ name: errName, message: errMsg, stack: errStack })
    );
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
