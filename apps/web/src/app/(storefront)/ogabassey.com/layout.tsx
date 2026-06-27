import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@/app/(storefront)/storefront-home-critical.css';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import { OgabasseyHomeShellFallback } from '@/app/(storefront)/ogabassey/ogabassey-home-shell-fallback';
import { OgabasseyStaticResourceHints } from '@/app/(storefront)/ogabassey/ogabassey-static-resource-hints';
import { OGABASSEY_URL } from '@/config/ogabassey';
import { OGABASSEY_STOREFRONT_IOS_APP_ID } from '@/config/platform';

// Co-locate with the Supabase primary (eu-west-1 / Dublin) — route handlers
// and sibling layouts do not inherit the [slug] layout preferredRegion.
export const preferredRegion = 'dub1';

const OGABASSEY_DOMAIN_IDENTIFIER = new URL(OGABASSEY_URL).hostname;
const OGABASSEY_DOMAIN_PARAMS = Promise.resolve({
  slug: OGABASSEY_DOMAIN_IDENTIFIER,
});

export { generateViewport };

export async function generateMetadata(): Promise<Metadata> {
  try {
    const metadata = await generateStorefrontLayoutMetadata({
      params: OGABASSEY_DOMAIN_PARAMS,
    });

    return {
      ...metadata,
      other: {
        ...metadata.other,
        'apple-itunes-app': `app-id=${OGABASSEY_STOREFRONT_IOS_APP_ID}`,
      },
    };
  } catch (error) {
    console.error('Failed to load OgaBassey domain layout metadata', error);
    return {
      other: {
        'apple-itunes-app': `app-id=${OGABASSEY_STOREFRONT_IOS_APP_ID}`,
      },
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
        loadingFallback={<OgabasseyHomeShellFallback />}
        params={OGABASSEY_DOMAIN_PARAMS}
      >
        {children}
      </StorefrontLayout>
    </>
  );
}
