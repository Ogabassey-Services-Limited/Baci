import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/(storefront)/storefront-home-critical.css';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { ShellChromeLoading } from '@/app/(storefront)/[slug]/storefront-loading-ui';
import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import { OGABASSEY_SHELL_MOBILE_HERO_IMAGE } from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_URL } from '@/config/ogabassey';

const OGABASSEY_DOMAIN_IDENTIFIER = new URL(OGABASSEY_URL).hostname;
const OGABASSEY_DOMAIN_PARAMS = Promise.resolve({
  slug: OGABASSEY_DOMAIN_IDENTIFIER,
});

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
    <>
      <OgabasseyStaticResourceHints />
      <StorefrontLayout
        loadingFallback={
          <ShellChromeLoading
            mobileHeroImage={OGABASSEY_SHELL_MOBILE_HERO_IMAGE}
            showChromeFrame
          />
        }
        params={OGABASSEY_DOMAIN_PARAMS}
      >
        {children}
      </StorefrontLayout>
    </>
  );
}
