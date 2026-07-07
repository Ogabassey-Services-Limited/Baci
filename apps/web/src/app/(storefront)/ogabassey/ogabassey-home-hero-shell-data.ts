import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { buildLaunchSlides } from '@/components/storefront/ogabassey/components/build-launch-slides';
import type { LaunchProductSlide } from '@/components/storefront/ogabassey/components/LaunchCarousel';
import { getCachedMerchant } from '@/lib/cached-data';
import { loadOgabasseyLaunchProducts } from './ogabassey-home-launch-products';

const OGABASSEY_MERCHANT_SLUG = 'ogabassey';

// The shell lookup runs on the critical path of the home page's FIRST flush
// (it feeds both the slide-0 preload and the non-hydrated fallback). It is
// cached ('use cache: remote'), so it is near-instant on a warm cache and a
// single round-trip on a cold miss — but a degraded/saturated backend could
// otherwise stall the entire shell paint. Cap it: past this budget we fail
// open to the generic baked banner (losing only the preload optimization,
// never the page).
const SHELL_LOOKUP_BUDGET_MS = 500;

export interface OgabasseyHomeHeroShell {
  slides: LaunchProductSlide[];
}

async function resolveShellSlides(
  pathPrefix: string
): Promise<OgabasseyHomeHeroShell | null> {
  const merchant = await getCachedMerchant(OGABASSEY_MERCHANT_SLUG);
  // `!== true` so a NULL publication status counts as unpublished — the
  // streamed page gates on `!merchant.is_published`, and the shell must never
  // show a product hero for a merchant the page will render as unpublished.
  if (!merchant?.id || merchant.is_published !== true) {
    return null;
  }

  // Per-leg failures inside loadOgabasseyLaunchProducts already degrade to
  // empty arrays, so a single failing feed cannot throw here. The streamed
  // interactive hero resolves the SAME cached loader, so the fallback and the
  // hero render identical (possibly degraded) data — the swap stays a no-op.
  const products = await loadOgabasseyLaunchProducts(merchant.id);
  const slides = buildLaunchSlides(products, pathPrefix);
  if (slides.length === 0) {
    return null;
  }

  return { slides };
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
  let budgetTimer: ReturnType<typeof setTimeout> | undefined;
  try {
    const budget = new Promise<null>((resolve) => {
      budgetTimer = setTimeout(() => resolve(null), SHELL_LOOKUP_BUDGET_MS);
    });
    return await Promise.race([resolveShellSlides(pathPrefix), budget]);
  } catch (error) {
    unstable_rethrow(error);
    console.error('Failed to resolve home hero shell slides', { error });
    return null;
  } finally {
    clearTimeout(budgetTimer);
  }
}
