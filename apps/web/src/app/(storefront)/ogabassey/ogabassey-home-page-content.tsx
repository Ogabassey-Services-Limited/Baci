import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { Suspense } from 'react';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TITLE } from '@/config/ogabassey';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';

interface OgabasseyHomePageContentProps {
  /** Static per-route path prefix, supplied by the parent (which renders the
   *  static hero with the same value). */
  pathPrefix: string;
  /** Restore the semantic page heading only after the request-scoped
   *  publication guard when the cached critical Hero could not be emitted. */
  renderFallbackHeading: boolean;
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
 * Request-scoped content below the permanent cached Hero. The parent owns the
 * complete critical viewport; this subtree may wait for headers and merchant
 * data without replacing or mutating the slide-0 LCP node.
 */
export async function OgabasseyHomePageContent({
  pathPrefix,
  renderFallbackHeading,
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
      {renderFallbackHeading ? (
        <h1 className="sr-only">{OGABASSEY_TITLE}</h1>
      ) : null}
      <Suspense fallback={null}>
        <OgabasseyHomeDynamicContent
          merchant={merchant}
          pathPrefix={resolvedPathPrefix}
        />
      </Suspense>
    </>
  );
}
