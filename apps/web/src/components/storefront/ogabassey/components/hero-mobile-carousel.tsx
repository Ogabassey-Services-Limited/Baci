'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useState } from 'react';
import { asRoute } from '@/lib/routes';
import type { LaunchProductSlide } from './LaunchCarousel';
import {
  MOBILE_HERO_IMAGE_QUALITY,
  MOBILE_HERO_IMAGE_SIZES,
} from './hero-mobile-image-config';
import { MobileLcpHeroImage } from './mobile-lcp-hero-image';

interface HeroMobileCarouselProps {
  /** Launch products (newest-first, pins applied). slides[0]'s image is the
   *  eager mobile LCP element; the rest lazy-load. Each slide deep-links to
   *  its PDP and is server-rendered so the links stay crawlable. */
  slides: LaunchProductSlide[];
}

export function HeroMobileCarousel({ slides }: HeroMobileCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const hasMultipleSlides = slides.length > 1;

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="md:hidden mb-4 order-1">
      <div
        aria-label="Featured launch product carousel"
        className="relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-store-border/70 bg-store-secondary"
        data-ogabassey-mobile-hero-panel="true"
        role="region"
      >
        {slides.map((slide, index) => {
          const isCurrent = index === currentSlide;
          const isMobileLcpImage = index === 0;
          const shouldRenderImage = isCurrent || isMobileLcpImage;

          return (
            <div
              key={slide.id}
              className={`absolute inset-0 grid grid-cols-5 transition-opacity [transition-duration:400ms] ease-in-out ${isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              aria-hidden={!isCurrent}
              inert={!isCurrent}
            >
              <div className="col-span-3 flex flex-col justify-center gap-1 px-5 py-4">
                <span className="text-[9px] font-semibold uppercase tracking-[0.12em] text-store-primary">
                  Just launched
                </span>
                <h2 className="line-clamp-2 text-[1.2rem] font-extrabold leading-tight text-store-secondary-text">
                  {slide.name}
                </h2>
                <p className="text-[11px] font-semibold text-store-secondary-text">
                  {slide.priceLabel}
                </p>
                <span className="mt-2 inline-flex w-fit items-center rounded-full bg-store-primary px-4 py-1.5 text-[11px] font-bold text-store-on-primary shadow-sm">
                  {slide.ctaLabel}
                </span>
              </div>
              <div className="relative col-span-2">
                {isMobileLcpImage ? (
                  <MobileLcpHeroImage
                    alt={slide.imageAlt}
                    imageFit="contain"
                    shouldPrioritizeImage
                    src={slide.imageUrl}
                  />
                ) : shouldRenderImage ? (
                  <Image
                    src={slide.imageUrl}
                    alt={slide.imageAlt}
                    fill
                    sizes={MOBILE_HERO_IMAGE_SIZES}
                    className="object-contain p-2"
                    loading="lazy"
                    quality={MOBILE_HERO_IMAGE_QUALITY}
                  />
                ) : null}
              </div>
              <Link
                href={asRoute(slide.href)}
                prefetch={false}
                aria-label={`${slide.name} — ${slide.ctaLabel}`}
                className="absolute inset-0"
              />
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
          {slides.map((slide, idx) => {
            const isActive = currentSlide === idx;

            return (
              <button
                key={slide.id}
                type="button"
                onClick={() => setCurrentSlide(idx)}
                className="flex h-11 min-w-11 items-center justify-center rounded-full cursor-pointer"
                aria-label={`Go to hero slide ${idx + 1}`}
                aria-current={isActive ? 'true' : undefined}
              >
                <span
                  className={`block h-1 rounded-full transition-[width] duration-300 ${isActive ? 'w-5 bg-store-primary' : 'w-1.5 bg-store-primary/30'}`}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
