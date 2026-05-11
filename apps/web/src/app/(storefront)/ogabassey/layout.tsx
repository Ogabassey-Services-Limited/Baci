import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import * as ReactDOM from 'react-dom';
import StorefrontLayout, {
  generateMetadata as generateStorefrontLayoutMetadata,
  generateViewport,
} from '@/app/(storefront)/[slug]/layout';
import {
  HERO_DESKTOP_LCP_SRC,
  HERO_MOBILE_LCP_SRC,
} from '@/components/storefront/ogabassey/components/hero-data';
import { OGABASSEY_CDN_ORIGIN } from '@/components/storefront/ogabassey/config/storefront-origins';
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
  ReactDOM.prefetchDNS(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preconnect(OGABASSEY_CDN_ORIGIN);
  ReactDOM.preload(HERO_DESKTOP_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(min-width: 768px)',
    type: 'image/avif',
  });
  ReactDOM.preload(HERO_MOBILE_LCP_SRC, {
    as: 'image',
    fetchPriority: 'high',
    media: '(max-width: 767px)',
    type: 'image/avif',
  });

  return (
    <StorefrontLayout params={OGABASSEY_PARAMS}>{children}</StorefrontLayout>
  );
}
