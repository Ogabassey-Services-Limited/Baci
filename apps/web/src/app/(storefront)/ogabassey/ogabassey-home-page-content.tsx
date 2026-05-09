import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';

function resolveOgabasseyHomeMerchantIdentifier(headersList: Headers): string {
  return resolveMerchantContextIdentifier(headersList) || OGABASSEY_TEMPLATE_ID;
}

interface OgabasseyHomePageContentProps {
  renderHero?: boolean;
}

export async function OgabasseyHomePageContent({
  renderHero = true,
}: OgabasseyHomePageContentProps = {}) {
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
      {renderHero && <Hero />}
      <Suspense fallback={null}>
        <OgabasseyHomeDynamicContent
          merchant={merchant}
          pathPrefix={pathPrefix}
        />
      </Suspense>
    </>
  );
}
