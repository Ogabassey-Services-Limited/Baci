import {
  OGABASSEY_SHELL_BANNER_INLINE_HEIGHT,
  OGABASSEY_SHELL_BANNER_INLINE_SRC,
  OGABASSEY_SHELL_BANNER_INLINE_WIDTH,
} from '@/config/ogabassey-shell-banner-inline';

// Full-width baked first-slide banner painted in the PPR static loading shell.
// It is a single inline-AVIF <img> spanning the whole hero panel so it is a
// LARGE, first-flush LCP candidate (zero network) — keeping the hero as the
// Largest Contentful Paint instead of demoting it to the navbar logo, while
// still showing the complete banner (copy + CTA + phone) rather than a lone
// phone. The live carousel swaps in once the dynamic content streams.
// Decorative: the shell wrapper is aria-hidden and the real carousel owns the
// accessible banner. Regenerate the asset with
// scripts/generate-ogabassey-shell-banner.mjs.
export function OgabasseyShellMobileHero() {
  return (
    <div className="mb-4">
      <div className="relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-black/5 bg-gray-100">
        <img
          alt=""
          aria-hidden="true"
          className="h-full w-full object-cover"
          decoding="sync"
          fetchPriority="high"
          height={OGABASSEY_SHELL_BANNER_INLINE_HEIGHT}
          loading="eager"
          src={OGABASSEY_SHELL_BANNER_INLINE_SRC}
          width={OGABASSEY_SHELL_BANNER_INLINE_WIDTH}
        />
      </div>
    </div>
  );
}
