import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import { StoreNotPublished } from '@/components/storefront/store-not-published';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';
import { getRequestScopedMerchant } from '@/lib/cached-data';
import { resolveMerchantContextIdentifier } from '@/lib/storefront-route-identifier';
import { OgabasseyHomeDynamicContent } from './ogabassey-home-dynamic-content';

interface OgabasseyHomePageContentProps {
  /** Static per-route path prefix, supplied by the parent (which renders the
   *  static hero with the same value). */
  pathPrefix: string;
}

function resolveOgabasseyHomeMerchantIdentifier(headersList: Headers): string {
  return resolveMerchantContextIdentifier(headersList) || OGABASSEY_TEMPLATE_ID;
}

/**
 * Below-the-fold dynamic content (product grid, analytics, full JSON-LD). It
 * uses the request-scoped merchant (headers) and so is the streamed dynamic hole
 * under PPR — the above-the-fold hero renders statically in the parent shell.
 */
export async function OgabasseyHomePageContent({
  pathPrefix,
}: OgabasseyHomePageContentProps) {
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

  return (
    <OgabasseyHomeDynamicContent merchant={merchant} pathPrefix={pathPrefix} />
  );
}
