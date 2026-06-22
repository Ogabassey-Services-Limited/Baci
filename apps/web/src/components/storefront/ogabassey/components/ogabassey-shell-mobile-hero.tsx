import Image from 'next/image';
import type { CSSProperties } from 'react';
import {
  OGABASSEY_SHELL_BANNER_INLINE_HEIGHT,
  OGABASSEY_SHELL_BANNER_INLINE_SRC,
  OGABASSEY_SHELL_BANNER_INLINE_WIDTH,
} from '@/config/ogabassey-shell-banner-inline';

// Full-width baked banner art painted in the PPR static loading shell. The
// inline AVIF is a large, first-flush LCP candidate (zero network) that holds
// the hero box until the live product-driven hero streams in and swaps over.
// Copy is deliberately product-agnostic ("Just launched") so the shell never
// advertises a specific device that the live hero may not lead with. The box
// height matches the live mobile hero (h-48) so there is no layout shift.
// Regenerate the art with scripts/generate-ogabassey-shell-banner.mjs.
const STORE_PRIMARY_COLOR = 'var(--store-primary)';
const STORE_BORDER_COLOR = 'var(--store-border)';
const STORE_ON_PRIMARY_COLOR = 'var(--store-on-primary)';

const HERO_CTA_STYLE = {
  backgroundColor: STORE_PRIMARY_COLOR,
  borderColor: STORE_BORDER_COLOR,
  color: STORE_ON_PRIMARY_COLOR,
} satisfies CSSProperties;

export function OgabasseyShellMobileHero() {
  return (
    <div className="mb-4" aria-hidden="true">
      <div className="relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-black/5 bg-gray-100">
        <div className="absolute inset-0 bg-[#F5F5F7]">
          <Image
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full object-cover"
            decoding="sync"
            fetchPriority="high"
            height={OGABASSEY_SHELL_BANNER_INLINE_HEIGHT}
            loading="eager"
            src={OGABASSEY_SHELL_BANNER_INLINE_SRC}
            unoptimized
            width={OGABASSEY_SHELL_BANNER_INLINE_WIDTH}
          />
          <div className="relative z-10 flex h-full items-center px-6 py-5">
            <div className="w-[46%] pr-2 text-gray-900">
              <h2 className="mb-2 font-sans text-2xl font-extrabold leading-tight drop-shadow-xs">
                Just Launched
              </h2>
              <p className="text-[11px] font-medium leading-relaxed opacity-90">
                The newest devices, in stock now.
              </p>
              <span
                className="mt-3 inline-flex min-h-12 items-center justify-center rounded-full border px-5 py-2 text-xs font-bold shadow-sm"
                style={HERO_CTA_STYLE}
              >
                Shop Now
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
