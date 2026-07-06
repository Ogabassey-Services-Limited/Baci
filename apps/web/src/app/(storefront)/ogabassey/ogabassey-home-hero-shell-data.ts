import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { buildLaunchSlides } from '@/components/storefront/ogabassey/components/build-launch-slides';
import type { LaunchProductSlide } from '@/components/storefront/ogabassey/components/LaunchCarousel';
import { getCachedMerchant } from '@/lib/cached-data';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

const OGABASSEY_MERCHANT_SLUG = 'ogabassey';

export interface OgabasseyHomeHeroShell {
  slides: LaunchProductSlide[];
}

/**
 * Cached-only slide lookup for the home hero's STATIC shell fallback.
 *
 * Mirrors `resolveBlogPostHeroShell`: every leg is `'use cache'`-backed
 * (`getCachedMerchant` + the launch-product lookups inside
 * `loadOgabasseyLaunchProducts`), so this is safe to await at the page root
 * under cacheComponents — it must NEVER touch request APIs
 * (`headers()`/`connection()`), which stay exclusively in
 * `ogabassey-home-page-content.tsx` (the #2479→#2637 PPR-resume hazard).
 *
 * Fail-open: any error degrades to `null`, which keeps today's generic baked
 * banner as the fallback — a cold cache miss or transient query failure must
 * not take down the shell.
 */
export async function resolveOgabasseyHomeHeroShell(
  pathPrefix: string
): Promise<OgabasseyHomeHeroShell | null> {
  try {
    const merchant = await getCachedMerchant(OGABASSEY_MERCHANT_SLUG);
    if (!merchant?.id || merchant.is_published === false) {
      return null;
    }

    // Per-leg failures inside loadOgabasseyLaunchProducts already degrade to
    // empty arrays, so a single failing feed cannot throw here.
    const products = await loadOgabasseyLaunchProducts(merchant.id);
    const slides = buildLaunchSlides(products, pathPrefix);
    if (slides.length === 0) {
      return null;
    }

    return { slides };
  } catch (error) {
    unstable_rethrow(error);
    console.error('Failed to resolve home hero shell slides', { error });
    return null;
  }
}
