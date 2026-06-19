import type { CSSProperties } from 'react';
import { MOBILE_SLIDES } from './hero-data';
import { MobileLcpHeroImage } from './mobile-lcp-hero-image';

// Static, non-interactive replica of the carousel's first (image) slide. It is
// rendered inside the PPR static loading shell so the real banner — including the
// inline-AVIF LCP image, copy, and CTA chrome — paints in the first HTML flush
// instead of flashing a lone product photo before the streamed carousel arrives.
// Reuses MobileLcpHeroImage + MOBILE_SLIDES[0] so the shell image is byte-identical
// to the streamed carousel image (single LCP candidate, zero extra fetch, no swap).
const FIRST_SLIDE = MOBILE_SLIDES[0];

const STORE_PRIMARY_COLOR = 'var(--store-primary)';
const STORE_BORDER_COLOR = 'var(--store-border)';
const STORE_ON_PRIMARY_COLOR = 'var(--store-on-primary)';

const HERO_CTA_STYLE = {
  backgroundColor: STORE_PRIMARY_COLOR,
  borderColor: STORE_BORDER_COLOR,
  color: STORE_ON_PRIMARY_COLOR,
} satisfies CSSProperties;

export function OgabasseyShellMobileHero() {
  const slide = FIRST_SLIDE;

  if (!slide || slide.type !== 'image' || !slide.src) {
    return null;
  }

  const usesContainedMedia = slide.imageFit === 'contain';

  return (
    <div className="mb-4">
      <div className="relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-black/5 bg-gray-100">
        <div className={`absolute inset-0 ${slide.bgClass ?? ''}`}>
          <div className="relative h-full flex items-center px-6 py-5 z-10">
            <div
              className={`${
                usesContainedMedia ? 'w-[46%] pr-2' : 'max-w-[55%]'
              } ${slide.textColor ?? ''}`}
            >
              <h2 className="text-2xl font-extrabold leading-tight mb-2 drop-shadow-xs font-sans">
                {slide.title}
              </h2>
              <p className="text-[11px] font-medium leading-relaxed opacity-90">
                {slide.subtitle}
              </p>
              <span
                className="mt-3 inline-flex min-h-12 items-center justify-center text-xs font-bold px-5 py-2 rounded-full shadow-sm border"
                style={HERO_CTA_STYLE}
              >
                Shop Now
              </span>
            </div>
          </div>
          <div className="absolute inset-0 z-0 pointer-events-none">
            <div
              className={
                usesContainedMedia
                  ? 'absolute inset-y-4 right-4 w-[43%]'
                  : 'relative h-full w-full'
              }
            >
              <MobileLcpHeroImage
                alt={slide.title || 'Hero slide'}
                imageFit={slide.imageFit}
                inlineSrc={slide.inlineSrc}
                shouldPrioritizeImage
                src={slide.src}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
