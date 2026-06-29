'use client';

import type React from 'react';
import { useEffect, useRef, useState } from 'react';
import { CarouselPlayToggle } from './carousel-play-toggle';
import { CarouselProgressFill } from './carousel-progress-fill';
import { LaunchSlideItem } from './launch-slide-item';
import { useCarouselAutoplay } from './use-carousel-autoplay';

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

/** A slide that hosts arbitrary content (e.g. an ad placement) — no PDP link. */
export interface LaunchAdSlide {
  kind: 'ad';
  id: string;
  content: React.ReactNode;
}

export type LaunchSlide = LaunchProductSlide | LaunchPromoSlide | LaunchAdSlide;

export interface LaunchCarouselProps {
  slides: LaunchSlide[];
  className?: string;
  /** Accessible name for the carousel region landmark. */
  regionLabel?: string;
  /** Eager/high-priority the first slide's image when the carousel is the
   *  topmost above-fold content (e.g. category pages), so it's a healthy LCP
   *  candidate. Defaults off (the homepage hero stays the LCP element). */
  prioritizeFirstSlide?: boolean;
}

const AUTOPLAY_INTERVAL_MS = 6000;
const MIN_SWIPE_DISTANCE_PX = 50;

export function LaunchCarousel({
  slides,
  className = 'h-52 md:h-60 lg:h-64',
  regionLabel = 'Just launched products',
  prioritizeFirstSlide = false,
}: LaunchCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  // Re-arms the active progress fill on a slide change / autoplay resume.
  const [progressCycle, setProgressCycle] = useState(0);
  // Transient pause while a touch gesture is active, so the slide can't advance
  // under the user's finger mid-swipe.
  const [isTouchActive, setIsTouchActive] = useState(false);
  const slideCount = slides.length;
  const autoplay = useCarouselAutoplay();
  // Rotation actually runs only when autoplay is active AND no touch is in
  // progress; track that combined state so the progress fill re-keys whenever
  // rotation resumes (autoplay toggle, hover/focus leave, or touch end).
  const isRunning = autoplay.isActive && !isTouchActive;
  const wasRunningRef = useRef(isRunning);
  // Swipe start X is held in a ref (not state) so finger movement does not
  // re-render the carousel on every pixel.
  const touchStartXRef = useRef<number | null>(null);
  // A handled swipe must not also fire the slide's full-bleed PDP link.
  const swipeHandledRef = useRef(false);
  const swipeResetTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (isRunning && !wasRunningRef.current) {
      setProgressCycle((value) => value + 1);
    }
    wasRunningRef.current = isRunning;
  }, [isRunning]);

  useEffect(() => {
    return () => {
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
      }
    };
  }, []);

  // WCAG 2.2.2 (Pause, Stop, Hide): autoplay stops on hover, on keyboard focus,
  // on the explicit toggle, and when the OS prefers reduced motion.
  useEffect(() => {
    if (slideCount <= 1 || !autoplay.isActive || isTouchActive) {
      return;
    }
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(timer);
    // `currentSlide` resets the timer on manual nav (no immediate double-advance).
  }, [slideCount, currentSlide, autoplay.isActive, isTouchActive]);

  // Keep the active index in range if the slide list ever shrinks.
  useEffect(() => {
    if (currentSlide > slideCount - 1) {
      setCurrentSlide(0);
    }
  }, [currentSlide, slideCount]);

  if (slideCount === 0) {
    return null;
  }

  const goNext = () => setCurrentSlide((prev) => (prev + 1) % slideCount);
  const goPrev = () =>
    setCurrentSlide((prev) => (prev - 1 + slideCount) % slideCount);

  const onTouchStart = (e: React.TouchEvent) => {
    touchStartXRef.current = e.targetTouches[0]?.clientX ?? null;
    setIsTouchActive(true);
  };
  const markSwipeHandled = () => {
    swipeHandledRef.current = true;
    // Safety net: clear the flag if the browser never emits the post-swipe
    // click, so the next genuine tap on a slide link isn't blocked.
    if (swipeResetTimerRef.current !== null) {
      window.clearTimeout(swipeResetTimerRef.current);
    }
    swipeResetTimerRef.current = window.setTimeout(() => {
      swipeHandledRef.current = false;
      swipeResetTimerRef.current = null;
    }, 400);
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    setIsTouchActive(false);
    const startX = touchStartXRef.current;
    touchStartXRef.current = null;
    if (startX === null) return;
    // Read the final position from the event rather than tracking it in state
    // during the move, so a swipe doesn't re-render on every pixel.
    const endX = e.changedTouches[0]?.clientX ?? startX;
    const distance = startX - endX;
    if (distance > MIN_SWIPE_DISTANCE_PX) {
      markSwipeHandled();
      goNext();
    } else if (distance < -MIN_SWIPE_DISTANCE_PX) {
      markSwipeHandled();
      goPrev();
    }
  };

  const onTouchCancel = () => {
    setIsTouchActive(false);
    touchStartXRef.current = null;
  };

  const onClickCapture = (e: React.MouseEvent) => {
    if (swipeHandledRef.current) {
      e.preventDefault();
      e.stopPropagation();
      swipeHandledRef.current = false;
      if (swipeResetTimerRef.current !== null) {
        window.clearTimeout(swipeResetTimerRef.current);
        swipeResetTimerRef.current = null;
      }
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

  const progressAnimates = slideCount > 1 && !autoplay.prefersReducedMotion;

  return (
    <div className="w-full">
      {/* Hover/focus pause is scoped to the panel (the auto-advancing content),
          NOT this wrapper — otherwise focusing the pause/play or dot controls
          below would keep autoplay inactive and the Play button wouldn't
          actually resume rotation. */}
      <div
        aria-label={regionLabel}
        aria-roledescription="carousel"
        className={`relative w-full overflow-hidden rounded-xl border border-store-border bg-store-background shadow-sm ${className}`}
        onClickCapture={onClickCapture}
        onKeyDown={onKeyDown}
        onTouchCancel={onTouchCancel}
        onTouchEnd={onTouchEnd}
        onTouchStart={onTouchStart}
        role="region"
        tabIndex={0}
        {...autoplay.containerHandlers}
      >
        <div
          className="flex h-full transition-transform duration-700 ease-in-out"
          style={{ transform: `translateX(-${currentSlide * 100}%)` }}
        >
        {slides.map((slide, idx) => (
          <LaunchSlideItem
            index={idx}
            isCurrent={idx === currentSlide}
            key={slide.id}
            prioritizeImage={prioritizeFirstSlide && idx === 0}
            slide={slide}
          />
        ))}
        </div>
      </div>

      {slideCount > 1 ? (
        <div className="mt-2 flex items-center gap-2 px-1">
          <div
            aria-label="Carousel slide controls"
            className="flex flex-1 items-center gap-1.5"
            role="group"
          >
            {slides.map((slide, idx) => {
              const isActive = idx === currentSlide;
              const isPast = idx < currentSlide;
              return (
                <button
                  aria-current={isActive ? 'true' : undefined}
                  aria-label={`Go to slide ${idx + 1}`}
                  className="group relative h-6 flex-1 cursor-pointer"
                  key={slide.id}
                  onClick={() => setCurrentSlide(idx)}
                  type="button"
                >
                  <span className="absolute inset-x-0 top-1/2 block h-1 -translate-y-1/2 overflow-hidden rounded-full bg-store-primary/20">
                    {isActive ? (
                      <CarouselProgressFill
                        animate={progressAnimates}
                        cycleKey={progressCycle * 1000 + currentSlide}
                        durationMs={AUTOPLAY_INTERVAL_MS}
                        isPaused={!autoplay.isActive || isTouchActive}
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
          {autoplay.prefersReducedMotion ? null : (
            // The controls row sits below the carousel on the page background,
            // so give the toggle a primary-filled circle for contrast (its icon
            // is `text-store-on-primary`, intended for a coloured surface).
            <CarouselPlayToggle
              className="bg-store-primary shadow-sm"
              isPlaying={autoplay.isPlaying}
              onToggle={autoplay.toggle}
            />
          )}
        </div>
      ) : null}
    </div>
  );
}
