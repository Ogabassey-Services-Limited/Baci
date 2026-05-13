import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { StorefrontLayoutLoadingFallback } from '@/app/(storefront)/[slug]/storefront-layout-loading-fallback';
import { OGABASSEY_TEMPLATE_ID } from '@/config/templates';

const OGABASSEY_PARAMS = Promise.resolve({ slug: OGABASSEY_TEMPLATE_ID });

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  try {
    return await generateStorefrontLayoutMetadata({
      params: OGABASSEY_PARAMS,
    });
  } catch (error) {
    console.error('Failed to load OgaBassey layout metadata', error);
    return {
      manifest: null,
    };
  }
}

export default function OgabasseyLayout({ children }: { children: ReactNode }) {
  return (
    <StorefrontLayout
      enableDynamicHeroPreloadDecision={false}
      loadingFallback={<StorefrontLayoutLoadingFallback />}
      params={OGABASSEY_PARAMS}
    >
      {children}
    </StorefrontLayout>
  );
}
