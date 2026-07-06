'use client';

import Image from 'next/image';
import Link from 'next/link';
import type { MouseEvent, TouchEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { asRoute } from '@/lib/routes';
import { CarouselPlayToggle } from './carousel-play-toggle';
import { CarouselProgressFill } from './carousel-progress-fill';
import type { LaunchProductSlide } from './LaunchCarousel';
import {
  MOBILE_HERO_IMAGE_QUALITY,
  MOBILE_HERO_IMAGE_SIZES,
} from './hero-mobile-image-config';
import {
  HERO_MOBILE_CONTROL_TRACK_CLASSES,
  HERO_MOBILE_CONTROLS_ROW_CLASSES,
  HERO_MOBILE_CTA_CLASSES,
  HERO_MOBILE_EYEBROW_CLASSES,
  HERO_MOBILE_IMAGE_COLUMN_CLASSES,
  HERO_MOBILE_PANEL_CLASSES,
  HERO_MOBILE_PRICE_CLASSES,
  HERO_MOBILE_SLIDE_GRID_CLASSES,
  HERO_MOBILE_TEXT_COLUMN_CLASSES,
  HERO_MOBILE_TITLE_CLASSES,
  HERO_MOBILE_WRAPPER_CLASSES,
} from './hero-mobile-geometry';
import { MobileLcpHeroImage } from './mobile-lcp-hero-image';

const AUTO_ADVANCE_MS = 5000;
const SWIPE_THRESHOLD_PX = 40;

interface HeroMobileCarouselProps {
  /** Launch products (newest-first, pins applied). slides[0]'s image is the
   *  eager mobile LCP element; the rest lazy-load. Each slide deep-links to
   *  its PDP and is server-rendered so the links stay crawlable. */
  slides: LaunchProductSlide[];
}

export function HeroMobileCarousel({ slides }: HeroMobileCarouselProps) {
  const slideCount = slides.length;
  const hasMultipleSlides = slideCount > 1;
  const [currentSlide, setCurrentSlide] = useState(0);
  // `cycle` increments to (re)start the current slide's countdown + fill.
  const [cycle, setCycle] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  // Persistent pause via the explicit control (WCAG 2.2.2), vs transient touch.
  const [userPaused, setUserPaused] = useState(false);
  // Pause while keyboard / screen-reader focus is inside the carousel so the
  // focused slide/link can't be hidden (inert) out from under the user.
  const [isFocusWithin, setIsFocusWithin] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const touchStartXRef = useRef<number | null>(null);
  const swipeHandledRef = useRef(false);
  const swipeResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(query.matches);
    const handleChange = (event: MediaQueryListEvent) => {
      setPrefersReducedMotion(event.matches);
    };
    query.addEventListener('change', handleChange);
    return () => query.removeEventListener('change', handleChange);
  }, []);

  // Keep the active index in range if the slide list ever shrinks, so the
  // carousel never points past the end and renders blank.
  useEffect(() => {
    if (currentSlide > slideCount - 1) {
      setCurrentSlide(0);
    }
  }, [currentSlide, slideCount]);

  const fillAnimates = hasMultipleSlides && !prefersReducedMotion;
  const autoAdvances =
    fillAnimates && !isPaused && !userPaused && !isFocusWithin;

  useEffect(() => {
    if (!autoAdvances) {
      return;
    }
    const timer = window.setTimeout(() => {
      setCurrentSlide((index) => (index + 1) % slideCount);
      setCycle((value) => value + 1);
    }, AUTO_ADVANCE_MS);
    return () => window.clearTimeout(timer);
    // `cycle` is a dependency so a manual restart re-arms a full countdown.
  }, [autoAdvances, currentSlide, cycle, slideCount]);

  if (slideCount === 0) {
    return null;
  }

  const goToSlide = (index: number) => {
    setCurrentSlide(((index % slideCount) + slideCount) % slideCount);
    setCycle((value) => value + 1);
  };

  const handleTouchStart = (event: TouchEvent) => {
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    swipeHandledRef.current = false;
    setIsPaused(true);
  };

  const handleTouchEnd = (event: TouchEvent) => {
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX !== null && hasMultipleSlides) {
      const endX = event.changedTouches[0]?.clientX ?? startX;
      const deltaX = endX - startX;
      if (Math.abs(deltaX) > SWIPE_THRESHOLD_PX) {
        swipeHandledRef.current = true;
        goToSlide(currentSlide + (deltaX < 0 ? 1 : -1));
        // Safety net: if the browser never emits the post-swipe click, clear the
        // suppression flag after a beat so the next genuine tap isn't blocked.
        if (swipeResetTimerRef.current !== null) {
          window.clearTimeout(swipeResetTimerRef.current);
        }
        swipeResetTimerRef.current = window.setTimeout(() => {
          swipeHandledRef.current = false;
          swipeResetTimerRef.current = null;
        }, 400);
      } else {
        // A tap/hold without a swipe just re-arms the current slide's timer.
        setCycle((value) => value + 1);
      }
    }
    setIsPaused(false);
  };

  // touchcancel (e.g. the browser hijacks the gesture for a vertical scroll)
  // fires instead of touchend — clear the same state so autoplay resumes.
  const handleTouchCancel = () => {
    touchStartXRef.current = null;
    swipeHandledRef.current = false;
    if (swipeResetTimerRef.current !== null) {
      window.clearTimeout(swipeResetTimerRef.current);
      swipeResetTimerRef.current = null;
    }
    setIsPaused(false);
    // Re-arm the countdown + fill so they resume in sync after the cancel.
    setCycle((value) => value + 1);
  };

  // A completed swipe must not also trigger the slide's full-bleed PDP link.
  const handleClickCapture = (event: MouseEvent) => {
    if (swipeHandledRef.current) {
      event.preventDefault();
      event.stopPropagation();
      swipeHandledRef.current = false;
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
        swipeResetTimerRef.current = null;
      }
    }
  };

  return (
    <div className={HERO_MOBILE_WRAPPER_CLASSES}>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: swipe gestures augment the dot/link controls; keyboard users use the buttons below. */}
      <div
        aria-label="Featured launch product carousel"
        aria-roledescription="carousel"
        className={HERO_MOBILE_PANEL_CLASSES}
        data-ogabassey-mobile-hero-panel="true"
        // Focus-within pause scoped to the PANEL (the auto-advancing link) only,
        // not the controls below — so the Play toggle resumes immediately.
        onBlur={(event) => {
          if (!event.currentTarget.contains(event.relatedTarget)) {
            setIsFocusWithin(false);
            // Re-arm countdown + fill together (timer restarts full on resume).
            setCycle((value) => value + 1);
          }
        }}
        onClickCapture={handleClickCapture}
        onFocus={() => setIsFocusWithin(true)}
        onTouchCancel={handleTouchCancel}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
        role="region"
      >
        {slides.map((slide, index) => {
          const isCurrent = index === currentSlide;
          const isMobileLcpImage = index === 0;
          const shouldRenderImage = isCurrent || isMobileLcpImage;

          return (
            <div
              key={slide.id}
              aria-hidden={!isCurrent}
              aria-label={`${index + 1} of ${slideCount}`}
              aria-roledescription="slide"
              className={`${HERO_MOBILE_SLIDE_GRID_CLASSES} transition-opacity [transition-duration:400ms] ease-in-out ${isCurrent ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              inert={!isCurrent}
              role="group"
            >
              <div className={HERO_MOBILE_TEXT_COLUMN_CLASSES}>
                <span className={HERO_MOBILE_EYEBROW_CLASSES}>
                  Just launched
                </span>
                <h2 className={HERO_MOBILE_TITLE_CLASSES}>
                  {slide.name}
                </h2>
                <p className={HERO_MOBILE_PRICE_CLASSES}>
                  {slide.priceLabel}
                </p>
                <span className={HERO_MOBILE_CTA_CLASSES}>
                  {slide.ctaLabel}
                </span>
              </div>
              <div className={HERO_MOBILE_IMAGE_COLUMN_CLASSES}>
                {isMobileLcpImage ? (
                  <MobileLcpHeroImage
                    alt={slide.imageAlt}
                    imageFit="contain"
                    shouldPrioritizeImage
                    src={slide.imageUrl}
                  />
                ) : shouldRenderImage ? (
                  <Image
                    alt={slide.imageAlt}
                    className="object-contain p-2"
                    fill
                    loading="lazy"
                    quality={MOBILE_HERO_IMAGE_QUALITY}
                    sizes={MOBILE_HERO_IMAGE_SIZES}
                    src={slide.imageUrl}
                  />
                ) : null}
              </div>
              <Link
                aria-label={`${slide.name} — ${slide.ctaLabel}`}
                className="absolute inset-0"
                href={asRoute(slide.href)}
                prefetch={false}
              >
                {/* Crawlable anchor text (visually hidden). */}
                <span className="sr-only">{`${slide.name} — ${slide.ctaLabel}`}</span>
              </Link>
            </div>
          );
        })}
      </div>

      {hasMultipleSlides ? (
        <div className={HERO_MOBILE_CONTROLS_ROW_CLASSES}>
          <div
            aria-label="Hero carousel slide controls"
            className="flex flex-1 items-center gap-1.5"
            role="group"
          >
            {slides.map((slide, idx) => {
            const isActive = currentSlide === idx;
            const isPast = idx < currentSlide;

            return (
              <button
                aria-current={isActive ? 'true' : undefined}
                aria-label={`Go to hero slide ${idx + 1}`}
                className={`group relative cursor-pointer ${HERO_MOBILE_CONTROL_TRACK_CLASSES}`}
                key={slide.id}
                onClick={() => goToSlide(idx)}
                type="button"
              >
                <span className="absolute inset-x-0 top-1/2 block h-1 -translate-y-1/2 overflow-hidden rounded-full bg-store-primary/20">
                  {isActive ? (
                    <CarouselProgressFill
                      animate={fillAnimates}
                      cycleKey={cycle}
                      durationMs={AUTO_ADVANCE_MS}
                      isPaused={isPaused || userPaused || isFocusWithin}
                    />
                  ) : (
                    <span
                      className={`block h-full origin-left rounded-full bg-store-primary transition-transform duration-300 ${isPast ? 'scale-x-100' : 'scale-x-0'}`}
                    />
                  )}
                </span>
              </button>
            );
          })}
          </div>
          {fillAnimates ? (
            // Persistent pause/play control (WCAG 2.2.2) for the auto-rotating
            // full-bleed link, for keyboard / pointer / screen-reader users.
            // Primary-filled circle for contrast on the page background.
            <CarouselPlayToggle
              className="bg-store-primary shadow-sm"
              isPlaying={!userPaused}
              onToggle={() => {
                // Resuming re-arms the countdown + fill together so they stay in
                // sync (the 5s timeout and WAAPI progress restart as one).
                if (userPaused) {
                  setCycle((value) => value + 1);
                }
                setUserPaused((value) => !value);
              }}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
