import { cacheLife, cacheTag } from 'next/cache';
import { buildLaunchSlides } from '@/components/storefront/ogabassey/components/build-launch-slides';
import { Hero } from '@/components/storefront/ogabassey/components/Hero';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

interface OgabasseyHomeHeroSectionProps {
  merchantId: string;
  pathPrefix: string;
}

/**
 * The product-driven hero renders in the PPR static shell (Next 16
 * cacheComponents): it reads only `use cache` data — the known OgaBassey
 * merchant id + cached launch products + a static per-route pathPrefix — so the
 * REAL hero is in the first byte of HTML, served from the edge. No Suspense
 * placeholder, no baked-banner swap, no FOUC. `'use cache'` makes the static
 * inclusion explicit and caches the rendered hero on the products lifetime.
 */
export async function OgabasseyHomeHeroSection({
  merchantId,
  pathPrefix,
}: OgabasseyHomeHeroSectionProps) {
  'use cache';
  cacheLife('products');
  cacheTag(`products-${merchantId}`);

  const launchProducts = await loadOgabasseyLaunchProducts(merchantId);
  const launchSlides = buildLaunchSlides(launchProducts, pathPrefix);

  return <Hero slides={launchSlides} />;
}
