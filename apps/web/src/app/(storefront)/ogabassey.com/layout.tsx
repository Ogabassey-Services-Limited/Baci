import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { ShellChromeLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import {
  HERO_MOBILE_LCP_FALLBACK_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_URL } from '@/config/ogabassey';

const OGABASSEY_DOMAIN_IDENTIFIER = new URL(OGABASSEY_URL).hostname;
const OGABASSEY_DOMAIN_PARAMS = Promise.resolve({
  slug: OGABASSEY_DOMAIN_IDENTIFIER,
});

const OGABASSEY_SHELL_MOBILE_HERO_IMAGE = {
  alt: 'OgaBassey storefront hero',
  avifSrc: HERO_MOBILE_LCP_SRC,
  fallbackSrc: HERO_MOBILE_LCP_FALLBACK_SRC,
} as const;

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  try {
    return await generateStorefrontLayoutMetadata({
      params: OGABASSEY_DOMAIN_PARAMS,
    });
  } catch (error) {
    console.error('Failed to load OgaBassey domain layout metadata', error);
    return {
      manifest: null,
    };
  }
}

export default function OgabasseyDomainLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <StorefrontLayout
      loadingFallback={
        <ShellChromeLoading
          mobileHeroImage={OGABASSEY_SHELL_MOBILE_HERO_IMAGE}
        />
      }
      params={OGABASSEY_DOMAIN_PARAMS}
    >
      {children}
    </StorefrontLayout>
  );
}
