import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';
import { OgabasseyHomeHeroSection } from './ogabassey-home-hero-section';

interface OgabasseyHomePageContentProps {
  /** Static per-route path prefix, supplied by the parent (which renders the
   *  static hero with the same value). */
  pathPrefix: string;
}

function resolveOgabasseyHomeMerchantIdentifier(headersList: Headers): string {
  return resolveMerchantContextIdentifier(headersList) || OGABASSEY_TEMPLATE_ID;
}

export function resolveOgabasseyHomePathPrefix(
  headersList: Headers,
  staticPathPrefix: string
): string {
  return resolveMerchantContextIdentifier(headersList) ? '' : staticPathPrefix;
}

/**
 * Request-scoped home content. The parent Suspense boundary prerenders the hero
 * fallback into the PPR shell, then this component streams the final hero and
 * below-the-fold content after request headers resolve.
 */
export async function OgabasseyHomePageContent({
  pathPrefix,
}: OgabasseyHomePageContentProps) {
  await connection();

  const headersList = await headers();
  const merchant = await getRequestScopedMerchant(
    resolveOgabasseyHomeMerchantIdentifier(headersList)
  );
  const resolvedPathPrefix = resolveOgabasseyHomePathPrefix(
    headersList,
    pathPrefix
  );

  if (!merchant) {
    notFound();
  }

  const isDevelopment = process.env.NODE_ENV === 'development';
  if (!merchant.is_published && !isDevelopment) {
    return <StoreNotPublished businessName={merchant.business_name} />;
  }

  return (
    <>
      <OgabasseyHomeHeroSection
        merchantId={merchant.id}
        pathPrefix={resolvedPathPrefix}
      />
      <Suspense fallback={null}>
        <OgabasseyHomeDynamicContent
          merchant={merchant}
          pathPrefix={resolvedPathPrefix}
        />
      </Suspense>
    </>
  );
}
