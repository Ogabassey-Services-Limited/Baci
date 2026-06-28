import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';
import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';
import { OgabasseyHomeHeroSection } from './ogabassey-home-hero-section';

function resolveOgabasseyHomeMerchantIdentifier(headersList: Headers): string {
  return resolveMerchantContextIdentifier(headersList) || OGABASSEY_TEMPLATE_ID;
}

export async function OgabasseyHomePageContent() {
  await connection();

  const headersList = await headers();
  const merchant = await getRequestScopedMerchant(
    resolveOgabasseyHomeMerchantIdentifier(headersList)
  );

  if (!merchant) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  const pathPrefix =
    headersList.has('x-custom-domain') || headersList.has('x-merchant-slug')
      ? ''
      : `/${merchant.slug}`;

  return (
    <>
      <Suspense fallback={<OgabasseyHomeHeroFallback />}>
        <OgabasseyHomeHeroSection
          merchantId={merchant.id}
          pathPrefix={pathPrefix}
        />
      </Suspense>
      <Suspense>
        <OgabasseyHomeDynamicContent
          merchant={merchant}
          pathPrefix={pathPrefix}
        />
      </Suspense>
    </>
  );
}
