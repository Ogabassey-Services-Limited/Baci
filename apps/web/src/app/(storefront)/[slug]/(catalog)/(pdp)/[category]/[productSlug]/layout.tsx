import type { ReactNode } from 'react';
import { preloadOgabasseyPdpProductResources } from '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints';
import { OGABASSEY_DOMAIN } from '@/config/ogabassey';
import { sanitizeLookupLogValue } from '@/lib/cached-data';
import { getKnownOgaBasseyMerchantId } from '@/lib/ogabassey-route-identity';

type CategoryProductLayoutProps = {
  children: ReactNode;
  params: Promise<{
    category: string;
    productSlug: string;
    slug: string;
  }>;
};

type OgabasseyPdpEarlyProductResourceHintsProps = {
  productSlug: string;
  storeSlug: string;
};

function preloadOgabasseyPdpEarlyProductResources({
  productSlug,
  storeSlug,
}: OgabasseyPdpEarlyProductResourceHintsProps): void {
  if (storeSlug.trim().toLowerCase() === OGABASSEY_DOMAIN.toLowerCase()) {
    return;
  }

  const merchantId = getKnownOgaBasseyMerchantId(storeSlug);

  if (!merchantId) {
    return;
  }

  try {
    preloadOgabasseyPdpProductResources({
      productSlug,
      src: null,
    });
  } catch (error) {
    console.warn(
      'Unable to preload OgaBassey PDP product resources from layout:',
      sanitizeLookupLogValue(productSlug),
      error
    );
  }
}

export default async function CategoryProductLayout({
  children,
  params,
}: CategoryProductLayoutProps) {
  const { productSlug, slug } = await params;
  preloadOgabasseyPdpEarlyProductResources({
    productSlug,
    storeSlug: slug,
  });

  return <>{children}</>;
}
