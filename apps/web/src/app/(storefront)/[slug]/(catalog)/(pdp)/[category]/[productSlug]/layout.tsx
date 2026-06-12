import type { ReactNode } from 'react';
import { preloadOgabasseyPdpProductResources } from '@/app/(storefront)/ogabassey/ogabassey-pdp-product-resource-hints';
import {
  getCachedProductLcpHint,
  sanitizeLookupLogValue,
} from '@/lib/cached-data';
import { getCachedProductLcpHintPrimaryImage } from '@/lib/cached-product-lcp-hint-primary-image';
import { getKnownOgaBasseyMerchantId } from '@/lib/ogabassey-route-identity';

const OGABASSEY_PDP_EARLY_PRODUCT_HINT_TIMEOUT_MS = 120;

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

type ProductHintLookupResult =
  | {
      cachedProduct: Awaited<ReturnType<typeof getCachedProductLcpHint>>;
      status: 'resolved';
    }
  | {
      error: unknown;
      status: 'rejected';
    }
  | {
      status: 'timeout';
    };

function getCachedProductLcpHintWithinBudget(
  merchantId: string,
  productSlug: string
): Promise<ProductHintLookupResult> {
  const lookupPromise = getCachedProductLcpHint(merchantId, productSlug).then(
    (cachedProduct): ProductHintLookupResult => ({
      cachedProduct,
      status: 'resolved',
    }),
    (error: unknown): ProductHintLookupResult => ({
      error,
      status: 'rejected',
    })
  );

  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<ProductHintLookupResult>((resolve) => {
    timeoutId = setTimeout(
      () => resolve({ status: 'timeout' }),
      OGABASSEY_PDP_EARLY_PRODUCT_HINT_TIMEOUT_MS
    );
  });

  return Promise.race([lookupPromise, timeoutPromise]).finally(() => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  });
}

async function preloadOgabasseyPdpEarlyProductResources({
  productSlug,
  storeSlug,
}: OgabasseyPdpEarlyProductResourceHintsProps): Promise<void> {
  const merchantId = getKnownOgaBasseyMerchantId(storeSlug);

  if (!merchantId) {
    return;
  }

  try {
    const result = await getCachedProductLcpHintWithinBudget(
      merchantId,
      productSlug
    );
    if (result.status === 'timeout') {
      console.warn(
        'Timed out preloading OgaBassey PDP product resources from layout:',
        sanitizeLookupLogValue(productSlug),
        `${OGABASSEY_PDP_EARLY_PRODUCT_HINT_TIMEOUT_MS}ms`
      );
      return;
    }

    if (result.status === 'rejected') {
      throw result.error;
    }

    const primaryImage = getCachedProductLcpHintPrimaryImage(
      result.cachedProduct
    );

    if (primaryImage) {
      preloadOgabasseyPdpProductResources({
        productSlug,
        src: primaryImage,
      });
    }
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
  await preloadOgabasseyPdpEarlyProductResources({
    productSlug,
    storeSlug: slug,
  });

  return <>{children}</>;
}
