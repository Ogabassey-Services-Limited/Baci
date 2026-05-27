import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { StorefrontLayoutLoadingFallback } from '@/app/(storefront)/[slug]/storefront-layout-loading-fallback';
import {
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
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
      loadingFallback={
        <StorefrontLayoutLoadingFallback
          mobileHeroImage={{
            alt: 'OgaBassey storefront hero',
            avifSrc: HERO_MOBILE_LCP_SRC,
            fallbackSrc: HERO_MOBILE_LCP_FALLBACK_SRC,
          }}
        />
      }
      params={OGABASSEY_PARAMS}
    >
      {children}
    </StorefrontLayout>
  );
}
