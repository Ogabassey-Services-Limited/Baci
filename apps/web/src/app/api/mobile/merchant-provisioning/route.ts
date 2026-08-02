import { after, type NextRequest, NextResponse } from 'next/server';
import { recordMobileOnboardingContractInvocation } from '@/lib/posthog/mobile-onboarding-contract-telemetry';
import { provisionCuratedHomepage } from '@/lib/storefront-defaults/provision-curated-homepage';
import { mobileMerchantProvisioningSchema } from '@/schemas/mobile-merchant-provisioning';
import { getMobileBearerUser } from './get-mobile-bearer-user';
import { loadMobileMerchantStarterFacts } from './load-mobile-merchant-starter-facts';
import {
  type MobilePlatform,
  MobileProvisioningError,
  provisionAuthenticatedMerchant,
} from './provision-authenticated-merchant';

export const maxDuration = 60;

function invalidInputResponse() {
  return NextResponse.json(
    {
      error: 'Please check the information you entered.',
      code: 'invalid_input',
    },
    { status: 400 }
  );
}

function getPlatform(request: NextRequest): MobilePlatform | null {
  const platform = request.headers.get('x-baci-platform');
  return platform === 'ios' || platform === 'android' ? platform : null;
}

function getPostgresCode(error: unknown): string | null {
  if (error instanceof MobileProvisioningError) {
    return error.pgCode;
  }
  if (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    typeof error.code === 'string'
  ) {
    return error.code;
  }
  return null;
}

function provisioningFailureResponse(error: unknown) {
  const pgCode = getPostgresCode(error);
  if (pgCode === 'PT422') {
    return NextResponse.json(
      {
        error: 'Your authenticated account is missing required identity data.',
        code: 'identity_incomplete',
      },
      { status: 422 }
    );
  }
  if (pgCode === 'PT409') {
    return NextResponse.json(
      {
        error: 'That store URL is unavailable. Please choose another.',
        code: 'slug_unavailable',
      },
      { status: 409 }
    );
  }
  if (pgCode === 'PT400') {
    return invalidInputResponse();
  }

  const stage =
    error instanceof Error && error.name === 'MobileMerchantStarterFactsError'
      ? 'facts_read'
      : 'rpc';
  console.error(
    'mobile-merchant-provisioning %s',
    'provisioning_failed',
    JSON.stringify({ stage, pgCode })
  );
  return NextResponse.json(
    {
      error: 'Could not finish store setup. Please try again.',
      code: 'provisioning_failed',
    },
    { status: 500 }
  );
}

// CSRF exempt: this native-only contract requires an explicit verified bearer
// credential and never falls back to browser cookies.
export async function POST(request: NextRequest) {
  const auth = await getMobileBearerUser(request);
  if (!auth.authenticated) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'unauthorized' },
      { status: 401 }
    );
  }

  after(() => recordMobileOnboardingContractInvocation('v2_authenticated'));

  const platform = getPlatform(request);
  if (!platform) {
    return invalidInputResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return invalidInputResponse();
  }

  const parsed = mobileMerchantProvisioningSchema.safeParse(body);
  if (!parsed.success) {
    return invalidInputResponse();
  }

  try {
    const merchant = await provisionAuthenticatedMerchant({
      supabase: auth.supabase,
      user: auth.user,
      input: parsed.data,
      platform,
    });
    const starterFacts = await loadMobileMerchantStarterFacts({
      supabase: auth.supabase,
      merchantId: merchant.merchantId,
      ownerUserId: auth.user.id,
    });

    const homepage = await provisionCuratedHomepage({
      supabase: auth.supabase,
      expectedOwnerUserId: auth.user.id,
      ...starterFacts,
    });
    if (homepage.status === 'failed')
      return provisioningFailureResponse(new MobileProvisioningError(null));

    return NextResponse.json({
      success: true,
      merchant: {
        id: merchant.merchantId,
        slug: starterFacts.merchantSlug,
      },
      created: merchant.created,
    });
  } catch (error) {
    return provisioningFailureResponse(error);
  }
}
