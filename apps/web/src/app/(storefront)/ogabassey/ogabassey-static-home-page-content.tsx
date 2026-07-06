import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_HOME_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
} from '@/config/ogabassey';
import { OgabasseyHomeHeroFallback } from './ogabassey-home-hero-fallback';
import { preloadOgabasseyHomeHeroResources } from './ogabassey-home-hero-resource-hints';
import { resolveOgabasseyHomeHeroShell } from './ogabassey-home-hero-shell-data';
import { OgabasseyHomePageContent } from './ogabassey-home-page-content';
import { OgabasseyHomeStyleLoader } from './ogabassey-home-style-loader';

interface OgabasseyStaticHomePageContentProps {
  /** Static per-route path prefix for storefront links: '' for the apex domain
   *  (ogabassey.com), '/ogabassey' for the path-based route. Passed as a
   *  constant from each route's page so the hero needs no per-request headers. */
  pathPrefix: string;
}

const ogabasseyStaticHomepageSchema = {
  '@context': 'https://schema.org',
  '@type': 'WebPage',
  name: OGABASSEY_TITLE,
  description: OGABASSEY_DESCRIPTION,
  url: OGABASSEY_HOME_URL,
  isPartOf: {
    '@type': 'WebSite',
    name: 'OgaBassey',
    url: OGABASSEY_HOME_URL,
  },
  primaryImageOfPage: {
    '@type': 'ImageObject',
    url: OGABASSEY_SOCIAL_IMAGE_URL,
  },
} as const;

export async function OgabasseyStaticHomePageContent({
  pathPrefix,
}: OgabasseyStaticHomePageContentProps) {
  // Cached-only lookup (never request APIs — those stay in the dynamic
  // subtree). Slide-0 becomes both a first-flush preload hint and a
  // pixel-identical fallback frame; failure degrades to the generic banner.
  const heroShell = await resolveOgabasseyHomeHeroShell(pathPrefix);
  const shellSlides = heroShell?.slides ?? null;
  if (shellSlides?.[0]) {
    preloadOgabasseyHomeHeroResources(shellSlides[0].imageUrl);
  }

  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      <OgabasseyHomeStyleLoader />
      {/* The static PPR shell first-flushes the REAL slide-0 hero frame (cached
          lookup, non-hydrated, same image URL as the streamed hero) so the LCP
          image is discoverable immediately and the Suspense swap is visually a
          no-op. The interactive carousel still streams after request headers
          resolve path-mode vs subdomain links. */}
      <Suspense
        fallback={<OgabasseyHomeHeroFallback shellSlides={shellSlides} />}
      >
        <OgabasseyHomePageContent pathPrefix={pathPrefix} />
      </Suspense>
    </>
  );
}
