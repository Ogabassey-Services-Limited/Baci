'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { CSSProperties } from 'react';
import { useState } from 'react';
import { asRoute } from '@/lib/routes';
import { MOBILE_SLIDES } from './hero-data';
import {
  MOBILE_HERO_IMAGE_QUALITY,
  MOBILE_HERO_IMAGE_SIZES,
} from './hero-mobile-image-config';
import { MobileLcpHeroImage } from './mobile-lcp-hero-image';

interface HeroMobileCarouselProps {
  getHref: (path: string) => string;
  hasResolvedViewport: boolean;
  isDesktopViewport: boolean;
}

const STORE_PRIMARY_FALLBACK = 'var(--store-primary, #d62027)';
const STORE_BORDER_FALLBACK = 'var(--store-border, rgba(214, 32, 39, 0.24))';
const STORE_ON_PRIMARY_FALLBACK = 'var(--store-on-primary, #ffffff)';

const HERO_CTA_STYLE: CSSProperties = {
  backgroundColor: STORE_PRIMARY_FALLBACK,
  borderColor: STORE_BORDER_FALLBACK,
  color: STORE_ON_PRIMARY_FALLBACK,
};

const getIndicatorStyle = (isActive: boolean): CSSProperties => ({
  backgroundColor: isActive ? STORE_PRIMARY_FALLBACK : STORE_BORDER_FALLBACK,
  opacity: isActive ? 1 : 0.65,
});

export function HeroMobileCarousel({
  getHref,
  hasResolvedViewport,
  isDesktopViewport,
}: HeroMobileCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const isResolvedMobileViewport = hasResolvedViewport && !isDesktopViewport;
  const shouldPrioritizeMobileLcpImage =
    !hasResolvedViewport || isResolvedMobileViewport;
  const hasMultipleSlides = MOBILE_SLIDES.length > 1;

  return (
    <div className="md:hidden mb-4 order-1">
      <div
        className="relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-black/5 bg-gray-100"
        data-ogabassey-mobile-hero-panel="true"
      >
        {MOBILE_SLIDES.map((slide, index) => {
          // The hero renders product image slides only. (The demo video and
          // sponsored ad slides were removed: stock third-party content + an ad
          // in the LCP region hurt CWV without earning their keep.)
          if (slide.type !== 'image' || !slide.src) {
            return null;
          }

          const isMobileLcpImage = index === 0;
          const usesContainedMedia = slide.imageFit === 'contain';

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity [transition-duration:400ms] ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'} ${slide.bgClass}`}
            >
              <div className="relative h-full flex items-center px-6 py-5 z-10">
                <div
                  className={`${
                    usesContainedMedia ? 'w-[46%] pr-2' : 'max-w-[55%]'
                  } ${slide.textColor} translate-y-1`}
                  data-ogabassey-mobile-hero-copy={
                    usesContainedMedia ? 'true' : undefined
                  }
                >
                  <h2 className="mt-1.5 mb-1 text-[1.375rem] font-extrabold leading-tight drop-shadow-xs font-sans">
                    {slide.title}
                  </h2>
                  <p className="text-[11px] font-medium leading-relaxed opacity-90">
                    {slide.subtitle}
                  </p>
                  <Link
                    href={asRoute(getHref('/products'))}
                    prefetch={false}
                    className="mt-3 inline-flex min-h-12 items-center justify-center text-xs font-bold px-5 py-2 rounded-full shadow-sm transition-opacity hover:opacity-90 border"
                    style={HERO_CTA_STYLE}
                  >
                    Shop Now
                  </Link>
                </div>
              </div>
              <div className="absolute inset-0 z-0 pointer-events-none">
                <div
                  className={
                    usesContainedMedia
                      ? 'absolute inset-y-4 right-4 w-[43%]'
                      : 'relative h-full w-full'
                  }
                  data-ogabassey-mobile-hero-media={
                    usesContainedMedia ? 'true' : undefined
                  }
                >
                  {isMobileLcpImage ? (
                    <MobileLcpHeroImage
                      alt={slide.title || 'Hero slide'}
                      imageFit={slide.imageFit}
                      inlineSrc={slide.inlineSrc}
                      shouldPrioritizeImage={shouldPrioritizeMobileLcpImage}
                      src={slide.src}
                    />
                  ) : (
                    <Image
                      src={slide.src}
                      alt={slide.title || 'Hero slide'}
                      fill
                      sizes={MOBILE_HERO_IMAGE_SIZES}
                      className={
                        slide.imageFit === 'contain'
                          ? 'object-contain object-right'
                          : 'object-cover'
                      }
                      loading="lazy"
                      quality={MOBILE_HERO_IMAGE_QUALITY}
                    />
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {hasMultipleSlides ? (
        <div
          aria-label="Hero carousel slide controls"
          className="mt-2 flex justify-center gap-1.5"
          role="group"
        >
          {MOBILE_SLIDES.map((slide, idx) => {
            const isActive = currentSlide === idx;

            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className="flex h-12 min-w-12 items-center justify-center rounded-full cursor-pointer"
                aria-label={`Go to hero slide ${idx + 1}`}
              >
                <span
                  className={`block h-1 rounded-full transition-[width,background-color,opacity] duration-300 ${isActive ? 'w-5' : 'w-1.5'}`}
                  style={getIndicatorStyle(isActive)}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
