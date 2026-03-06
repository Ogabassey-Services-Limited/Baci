import { cookies } from 'next/headers';
import { after, type NextRequest, NextResponse } from 'next/server';
import { env } from '@/env';
import type { MobileOnboardingProfile } from '@/lib/mobile-onboarding/metadata';
import { provisionMobileOnboarding } from '@/lib/mobile-onboarding/provision';
import { checkPasswordBreach } from '@/lib/password-breach';
import { createScopedClient } from '@/lib/supabase/scoped';
import { createClient } from '@/lib/supabase/server';
import { mobileOnboardingSchema } from '@/schemas/onboarding';
import type { BrandColors } from '@/types';

// Allow up to 60s — template generation calls an AI model (Gemini)
// and hero-image assignment can also be slow. The default 10s is not enough.
export const maxDuration = 60;

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

    const finalBusinessType =
      businessType === 'other'
        ? otherBusinessType || businessType
        : businessType;
    const onboardingSlug =
      providedSlug ||
      businessName
        .split(' ')[0]
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '') ||
      'store';

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    let scopedSupabase = supabase;
    const onboardingProfile: MobileOnboardingProfile = {
      email,
      fullName: fullName ?? null,
      firstName: firstName || null,
      lastName: lastName || null,
      businessName,
      businessType: finalBusinessType,
      otherBusinessType: otherBusinessType || null,
      phone: phone || null,
      slug: onboardingSlug,
      logoUrl: logoUrl || null,
      brandColors,
    };

    // --- 2. User Creation / Auth ---

    // Check if request is authenticated (Bearer token or Cookie)
    const {
      data: { user: currentUser },
    } = await supabase.auth.getUser();

    let user = currentUser;

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
              first_name: firstName,
              last_name: lastName,
              business_name: businessName,
              business_type: finalBusinessType,
              other_business_type: otherBusinessType || null,
              phone: phone || null,
              slug: onboardingSlug,
              logo_url: logoUrl || null,
              brand_colors: brandColors,
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
        scopedSupabase = createScopedClient(signUpData.session.access_token);
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

    const result = await provisionMobileOnboarding({
      supabase: scopedSupabase,
      user: {
        id: user.id,
        email: user.email ?? email,
      },
      profile: onboardingProfile,
      rootDomain: env.NEXT_PUBLIC_ROOT_DOMAIN,
      defer: after,
      overwriteExistingProfile: true,
    });

    if (!result.success) {
      return NextResponse.json(result.body, { status: result.status });
    }

    return NextResponse.json(result);
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
