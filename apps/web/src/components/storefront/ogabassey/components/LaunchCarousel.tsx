'use client';

import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { asRoute } from '@/lib/routes';

/** A slide backed by a real catalog product (reuses the served CDN image). */
export interface LaunchProductSlide {
  kind: 'product';
  id: string;
  name: string;
  /** Pre-formatted price label, e.g. "₦50,000". */
  priceLabel: string;
  /** basePath-joined PDP path, e.g. "/ogabassey/smartphones/...". */
  href: string;
  imageUrl: string;
  imageAlt: string;
  ctaLabel: string;
}

/** A purely promotional slide — CSS-only + theme-driven, no image. */
export interface LaunchPromoSlide {
  kind: 'promo';
  id: string;
  title: string;
  subtitle?: string;
  href?: string;
  ctaLabel?: string;
}

export type LaunchSlide = LaunchProductSlide | LaunchPromoSlide;

export interface LaunchCarouselProps {
  slides: LaunchSlide[];
  className?: string;
}

const AUTOPLAY_INTERVAL_MS = 6000;
const MIN_SWIPE_DISTANCE_PX = 50;

function ProductSlideBody({ slide }: { slide: LaunchProductSlide }) {
  return (
    <div className="grid h-full grid-cols-5 bg-store-background">
      <div className="col-span-3 flex flex-col justify-center gap-1 bg-store-primary px-5 py-4 text-store-on-primary md:col-span-3 md:px-8">
        <span className="text-[10px] font-semibold uppercase tracking-[0.12em] opacity-80">
          Just launched
        </span>
        <h3 className="line-clamp-2 text-lg font-bold leading-tight md:text-2xl">
          {slide.name}
        </h3>
        <p className="text-sm font-semibold opacity-90 md:text-base">
          {slide.priceLabel}
        </p>
        <span className="mt-2 inline-flex w-fit items-center rounded-full bg-store-on-primary px-4 py-1.5 text-xs font-bold text-store-primary shadow-sm transition-transform active:scale-95 md:text-sm">
          {slide.ctaLabel}
        </span>
      </div>
      <div className="relative col-span-2 bg-store-background">
        <Image
          src={slide.imageUrl}
          alt={slide.imageAlt}
          fill
          sizes="(max-width: 768px) 40vw, 320px"
          className="object-contain p-2"
          loading="lazy"
          fetchPriority="low"
        />
      </div>
    </div>
  );
}

function PromoSlideBody({ slide }: { slide: LaunchPromoSlide }) {
  return (
    <div className="flex h-full flex-col justify-center gap-1 bg-store-primary px-6 text-store-on-primary md:px-10">
      <h3 className="line-clamp-2 text-xl font-bold leading-tight md:text-3xl">
        {slide.title}
      </h3>
      {slide.subtitle ? (
        <p className="line-clamp-2 max-w-md text-sm opacity-90 md:text-lg">
          {slide.subtitle}
        </p>
      ) : null}
      {slide.ctaLabel ? (
        <span className="mt-3 inline-flex w-fit items-center rounded-full bg-store-on-primary px-5 py-2 text-xs font-bold text-store-primary shadow-sm transition-transform active:scale-95 md:text-sm">
          {slide.ctaLabel}
        </span>
      ) : null}
    </div>
  );
}

export function LaunchCarousel({
  slides,
  className = 'h-52 md:h-60 lg:h-64',
}: LaunchCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  const slideCount = slides.length;

  // Autoplay; paused on hover/focus so it satisfies WCAG 2.2.2 (Pause, Stop,
  // Hide) — users can stop the motion by hovering or tabbing into the carousel.
  useEffect(() => {
    if (slideCount <= 1 || isPaused) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [slideCount, isPaused]);

  if (slideCount === 0) {
    return null;
  }

  const goNext = () => setCurrentSlide((prev) => (prev + 1) % slideCount);
  const goPrev = () =>
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);

  const onTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };
  const onTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  const onTouchEnd = () => {
    if (touchStart === null || touchEnd === null) return;
    const distance = touchStart - touchEnd;
    if (distance > MIN_SWIPE_DISTANCE_PX) {
      goNext();
    } else if (distance < -MIN_SWIPE_DISTANCE_PX) {
      goPrev();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      goNext();
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      goPrev();
    }
  };

  const onBlur = (e: React.FocusEvent) => {
    // Resume only when focus truly leaves the carousel (not when moving between
    // its own slides/dots).
    if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
      setIsPaused(false);
    }
  };

  return (
    <div
      aria-label="Just launched products"
      aria-roledescription="carousel"
      className={`relative w-full overflow-hidden rounded-xl border border-store-border bg-store-background shadow-sm ${className}`}
      onBlur={onBlur}
      onFocus={() => setIsPaused(true)}
      onKeyDown={onKeyDown}
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      onTouchEnd={onTouchEnd}
      onTouchMove={onTouchMove}
      onTouchStart={onTouchStart}
      role="region"
      tabIndex={0}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, idx) => {
          const isCurrent = idx === currentSlide;
          const label =
            slide.kind === 'product'
              ? `${slide.name} — ${slide.ctaLabel}`
              : (slide.ctaLabel ?? slide.title);
          return (
            <div
              key={slide.id}
              className="relative h-full w-full shrink-0"
              aria-hidden={!isCurrent}
              inert={!isCurrent}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${idx + 1}: ${slide.kind === 'product' ? slide.name : slide.title}`}
            >
              {slide.kind === 'product' ? (
                <ProductSlideBody slide={slide} />
              ) : (
                <PromoSlideBody slide={slide} />
              )}
              {slide.href ? (
                <Link
                  aria-label={label}
                  className="absolute inset-0"
                  href={asRoute(slide.href)}
                  prefetch={false}
                />
              ) : null}
            </div>
          );
        })}
      </div>

      {slideCount > 1 ? (
        <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
          {slides.map((slide, idx) => {
            const isCurrent = idx === currentSlide;
            return (
              <button
                aria-current={isCurrent ? 'true' : undefined}
                aria-label={`Go to slide ${idx + 1}`}
                className="group flex h-11 min-w-11 items-center justify-center rounded-full"
                key={slide.id}
                onClick={() => setCurrentSlide(idx)}
                type="button"
              >
                <span
                  className={`block h-1.5 rounded-full shadow-sm transition-all duration-300 ${isCurrent ? 'w-6' : 'w-1.5'}`}
                  style={{
                    backgroundColor: isCurrent
                      ? 'var(--store-on-primary, #ffffff)'
                      : 'color-mix(in srgb, var(--store-on-primary, #ffffff) 45%, transparent)',
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}
