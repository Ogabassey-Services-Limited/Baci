import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import {
  OGABASSEY_DESCRIPTION,
  OGABASSEY_HOME_URL,
  OGABASSEY_SOCIAL_IMAGE_URL,
  OGABASSEY_TITLE,
} from '@/config/ogabassey';
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
  // subtree). This is the single owner of the homepage Hero: the same tree is
  // emitted in the static artifact and hydrated in place, so request-time
  // content can never replace the LCP node. Unknown/unpublished state omits
  // the shopping surface rather than leaking a Shop Now shell before guards.
  const heroShell = await resolveOgabasseyHomeHeroShell(pathPrefix);
  const shellSlides =
    heroShell?.status === 'published' ? heroShell.slides : null;
  if (shellSlides?.[0]) {
    preloadOgabasseyHomeHeroResources(shellSlides[0].imageUrl);
  }

  return (
    <>
      <JsonLd data={ogabasseyStaticHomepageSchema} />
      <OgabasseyHomeStyleLoader />
      {shellSlides ? <Hero slides={shellSlides} /> : null}
      {/* Merchant validation, analytics and the product grid are deliberately
          below the permanent critical viewport. They may stream, suspend or
          fail without replacing the Hero DOM or its slide-0 image. */}
      <Suspense fallback={null}>
        <OgabasseyHomePageContent
          pathPrefix={pathPrefix}
          renderFallbackHeading={!shellSlides}
        />
      </Suspense>
    </>
  );
}
