import { NextResponse } from 'next/server';
import { getCachedGoogleMerchantFeedData } from '@/app/api/feed/google-merchant/feed-data';
import { getMerchantForUser } from '@/lib/merchant-server';
import { buildStoreUrl } from '@/lib/store-url';
import { buildGoogleMerchantReadiness } from '@/lib/storefront-trust/build-google-merchant-readiness';
import { buildMerchantTrustProfile } from '@/lib/storefront-trust/build-merchant-trust-profile';

export async function GET() {
  const { merchant, user } = await getMerchantForUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!merchant) {
    return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
  }

  const baseUrl = buildStoreUrl({
    slug: merchant.slug ?? merchant.id,
    custom_domain: merchant.custom_domain ?? undefined,
  });
  const trustProfile = buildMerchantTrustProfile(merchant, baseUrl);
  const feedData = await getCachedGoogleMerchantFeedData(
    merchant.id,
    merchant.slug ?? merchant.id
  );

  return NextResponse.json(
    buildGoogleMerchantReadiness({
      merchant,
      trustProfile,
      feedData,
    })
  );
}
