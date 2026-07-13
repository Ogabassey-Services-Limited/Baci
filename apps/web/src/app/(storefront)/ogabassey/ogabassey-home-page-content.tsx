import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import type { LaunchProductSlide } from '@/components/storefront/ogabassey/components/LaunchCarousel';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TITLE } from '@/config/ogabassey';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';

interface OgabasseyHomePageContentProps {
  /** Static per-route path prefix supplied by the parent. */
  pathPrefix: string;
  /** Cached shell data is safe to prepare before request resolution, but must
   *  not become shopping UI until this component confirms publication. */
  shellMerchantId: string | null;
  shellSlides: LaunchProductSlide[] | null;
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
 * Request-scoped publication boundary for the homepage shopping surface. The
 * static parent may prepare and preload slide data, but this component is the
 * sole owner of the visible Hero and its PDP links.
 */
export async function OgabasseyHomePageContent({
  pathPrefix,
  shellMerchantId,
  shellSlides,
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

  // The static shell is built from the canonical OgaBassey record before
  // request resolution. Bind it to that exact tenant so a reassigned domain or
  // stale identifier mapping can never render another merchant's catalog.
  const requestMerchantShellSlides =
    shellMerchantId === merchant.id ? shellSlides : null;

  return (
    <>
      {requestMerchantShellSlides ? (
        <Hero slides={requestMerchantShellSlides} />
      ) : (
        <h1 className="sr-only">{OGABASSEY_TITLE}</h1>
      )}
      <Suspense fallback={null}>
        <OgabasseyHomeDynamicContent
          merchant={merchant}
          pathPrefix={resolvedPathPrefix}
        />
      </Suspense>
    </>
  );
}
