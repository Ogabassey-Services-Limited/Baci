import { buildLaunchSlides } from '@/components/storefront/ogabassey/components/build-launch-slides';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

interface OgabasseyHomeHeroSectionProps {
  merchantId: string;
  pathPrefix: string;
}

/**
 * Product-driven hero for the published, request-resolved storefront boundary.
 * Keep this component uncached: `loadOgabasseyLaunchProducts()` intentionally
 * degrades transient feed failures to `[]`, and caching this wrapper would make
 * that temporary empty hero sticky. The underlying product loaders own their
 * data caches and tags.
 */
export async function OgabasseyHomeHeroSection({
  merchantId,
  pathPrefix,
}: OgabasseyHomeHeroSectionProps) {
  const launchProducts = await loadOgabasseyLaunchProducts(merchantId);
  const launchSlides = buildLaunchSlides(launchProducts, pathPrefix);

  return <Hero slides={launchSlides} />;
}
