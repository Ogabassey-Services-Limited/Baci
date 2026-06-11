import type { ReactNode } from 'react';
import { Suspense } from 'react';
import { preloadOgabasseyPdpProductResources } from '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints';
import {
  getCachedProductLcpHint,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { getCachedProductLcpHintPrimaryImage } from '@/lib/cached-product-lcp-hint-primary-image';
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

async function OgabasseyPdpEarlyProductResourceHints({
  productSlug,
  storeSlug,
}: OgabasseyPdpEarlyProductResourceHintsProps): Promise<null> {
  const merchantId = getKnownOgaBasseyMerchantId(storeSlug);

  if (!merchantId) {
    return null;
  }

  try {
    const cachedProduct = await getCachedProductLcpHint(
      merchantId,
      productSlug
    );
    const primaryImage = getCachedProductLcpHintPrimaryImage(cachedProduct);

    if (primaryImage) {
      preloadOgabasseyPdpProductResources({ src: primaryImage });
    }
  } catch (error) {
    console.warn(
      'Unable to preload OgaBassey PDP product resources from layout:',
      sanitizeLookupLogValue(productSlug),
      error
    );
  }

  return null;
}

export default async function CategoryProductLayout({
  children,
  params,
}: CategoryProductLayoutProps) {
  const { productSlug, slug } = await params;

  return (
    <>
      <Suspense fallback={null}>
        <OgabasseyPdpEarlyProductResourceHints
          productSlug={productSlug}
          storeSlug={slug}
        />
      </Suspense>
      {children}
    </>
  );
}
