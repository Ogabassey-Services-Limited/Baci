import { after, type NextRequest, NextResponse } from 'next/server';
import { normalizeBusinessName } from '@/lib/normalize-business-name';
import { recordMobileOnboardingContractInvocation } from '@/lib/posthog/mobile-onboarding-contract-telemetry';
import { DEFAULT_CURATED_BRAND_COLORS } from '@/lib/storefront-defaults/default-curated-brand-colors';
import { provisionCuratedHomepage } from '@/lib/storefront-defaults/provision-curated-homepage';
import { parseBrandColors } from '@/schemas/brand-colors';
import { mobileOnboardingSchema } from '@/schemas/onboarding';
import {
  MobileProvisioningError,
  provisionAuthenticatedMerchant,
} from '../mobile/merchant-provisioning/provision-authenticated-merchant';
import { runLegacyMobileSignup } from './legacy-mobile-signup';
import { buildOnboardingFailureResponse } from './onboarding-failure-response';

export const maxDuration = 60;

function getLegacyPlatform(request: NextRequest): 'ios' | 'android' {
  const userAgent = request.headers.get('user-agent')?.toLowerCase() ?? '';
  return userAgent.includes('iphone') ||
    userAgent.includes('ipad') ||
    userAgent.includes('ios')
    ? 'ios'
    : 'android';
}

function validationError(message: string) {
  return NextResponse.json({ error: message }, { status: 400 });
}

function provisioningErrorResponse(error: unknown, accountCreated: boolean) {
  if (error instanceof MobileProvisioningError) {
    if (error.pgCode === 'PT409' && !accountCreated) {
      return NextResponse.json(
        {
          error: 'That store URL is unavailable. Please choose another.',
          code: 'slug_unavailable',
        },
        { status: 409 }
      );
    }
    if (error.pgCode === 'PT400' && !accountCreated) {
      return NextResponse.json(
        {
          error: 'Please check the information you entered.',
          code: 'invalid_input',
        },
        { status: 400 }
      );
    }
    if (error.pgCode === 'PT422') {
      return NextResponse.json(
        {
          error: 'Your account is missing required identity data.',
          code: 'identity_incomplete',
        },
        { status: 422 }
      );
    }
  }
  return buildOnboardingFailureResponse(error, {
    accountExists: accountCreated,
  });
}

function parseLegacyBrandColors(value: string | undefined) {
  if (!value) {
    return null;
  }
  try {
    return parseBrandColors(JSON.parse(value));
  } catch {
    return null;
  }
}

// Legacy CSRF exemption: installed Expo builds call this temporary compatibility
// contract without browser cookies. New builds use the bearer-only v2 route.
export async function POST(request: NextRequest) {
  after(() => recordMobileOnboardingContractInvocation('v1_legacy'));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return validationError('Validation failed: Invalid JSON.');
  }

  const parsed = await mobileOnboardingSchema.safeParseAsync(body);
  if (!parsed.success) {
    return validationError(
      `Validation failed: ${parsed.error.issues
        .map((issue) => issue.message)
        .join(', ')}`
    );
  }

  const {
    email,
    password,
    firstName,
    lastName,
    phone,
    businessName: rawBusinessName,
    businessType,
    otherBusinessType,
    country,
    slug,
    slugIsCustom,
    logoUrl,
    brandColors: brandColorsJson,
  } = parsed.data;

  if (!firstName || !lastName) {
    return validationError(
      'Validation failed: First name and last name are required.'
    );
  }

  const hasSlug = typeof slug === 'string' && slug.length > 0;
  const signupTreatsSlugAsCustom = slugIsCustom !== false && hasSlug;
  const auth = await runLegacyMobileSignup({
    request,
    email,
    password,
    firstName,
    lastName,
    slug,
    slugIsCustom: signupTreatsSlugAsCustom,
  });
  if (!auth.ok) {
    return auth.response;
  }

  const businessName = normalizeBusinessName(rawBusinessName);
  const brandColors = parseLegacyBrandColors(brandColorsJson);
  const platform = getLegacyPlatform(request);

  try {
    const merchant = await provisionAuthenticatedMerchant({
      supabase: auth.supabase,
      user: auth.user,
      platform,
      input: {
        firstName,
        lastName,
        phone,
        businessName,
        businessType,
        otherBusinessType,
        country,
        slug,
        slugIsCustom: auth.accountCreated
          ? signupTreatsSlugAsCustom
          : slugIsCustom === true && hasSlug,
        logoUrl,
        brandColors: brandColors ?? undefined,
      },
    });

    const homepage = await provisionCuratedHomepage({
      supabase: auth.supabase,
      expectedOwnerUserId: auth.user.id,
      merchantId: merchant.merchantId,
      merchantSlug: merchant.merchantSlug,
      merchantLogoUrl: logoUrl,
      businessName,
      businessType:
        businessType === 'other'
          ? (otherBusinessType ?? businessType)
          : businessType,
      brandColors: brandColors ?? DEFAULT_CURATED_BRAND_COLORS,
    });
    if (homepage.status === 'failed')
      return provisioningErrorResponse(
        new MobileProvisioningError(null),
        auth.accountCreated
      );

    return NextResponse.json({
      success: true,
      user: { id: auth.user.id, email: auth.user.email ?? email },
      merchant: { id: merchant.merchantId, slug: merchant.merchantSlug },
      message: 'Account created successfully',
    });
  } catch (error) {
    return provisioningErrorResponse(error, auth.accountCreated);
  }
}
