'use client';

// Migrated from temp-source/components/BannerCarousel.tsx
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useState } from 'react';
import { AdUnit } from '@/components/storefront/ogabassey/components/AdUnit';
import { asRoute, joinRouteBasePath } from '@/lib/routes';
import { SPONSORED_SLIDE_AD_BOOT_DELAY_MS } from '../config/ads';
import {
  BANNER_SLIDES,
  type BannerSlide,
  PROMO_CTA,
  PROMO_SUBTITLE,
  PROMO_TEXT_PANEL,
  PROMO_TITLE,
} from './banner-carousel-content';
import { CarouselPlayToggle } from './carousel-play-toggle';
import { useCarouselAutoplay } from './use-carousel-autoplay';

export interface BannerCarouselProps {
  basePath?: string;
  className?: string;
  categoryImage?: string | null;
  title?: string;
  description?: string;
}

export function resolveBannerHref(basePath: string, path: string) {
  return joinRouteBasePath(basePath, path);
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  basePath = '',
  className = 'h-40 md:h-52',
  categoryImage,
  title,
  description,
}) => {
  const getHref = (path: string) => resolveBannerHref(basePath, path);

  const [currentSlide, setCurrentSlide] = useState(0);
  const autoplay = useCarouselAutoplay();

  // Dynamic slides based on props
  const slides = (() => {
    if (categoryImage) {
      const customSlide: BannerSlide = {
        id: 0,
        type: 'image',
        imageUrl: categoryImage,
        title: title || 'Shop Now',
        subtitle: description || 'Explore our best collection',
      };
      return [customSlide, ...BANNER_SLIDES];
    }
    return BANNER_SLIDES;
  })();
  // Derive primitives from `slides` so the autoplay effect depends on stable
  // values (not the inline array's identity, which churns every render) without
  // mutating a ref during render — React-19/Compiler-safe.
  const slideCount = slides.length;
  const isCurrentSlideAd = slides[currentSlide]?.type === 'ad';

  // Touch handling state
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);

  // Minimum swipe distance (in px)
  const minSwipeDistance = 50;

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
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }

    if (isRightSwipe) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  useEffect(() => {
    // WCAG 2.2.2: stop on hover/focus, on the explicit toggle, and on reduced
    // motion. Also pause on an ad slide so video ads can play through uncut.
    if (!autoplay.isActive || isCurrentSlideAd) {
      return;
    }

    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slideCount);
    }, 6000);
    return () => clearInterval(timer);
    // currentSlide stays in deps so manual navigation resets the 6s timer.
  }, [currentSlide, autoplay.isActive, isCurrentSlideAd, slideCount]);

  const [adRefreshTrigger, setAdRefreshTrigger] = useState(0);

  // Adjust state during render with a prev-comparison instead of an effect
  // (https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const [prevSlideIndex, setPrevSlideIndex] = useState<number | null>(null);
  if (prevSlideIndex !== currentSlide) {
    setPrevSlideIndex(currentSlide);
    if (slides[currentSlide]?.type === 'ad') {
      // Trigger ad refresh when ad slide becomes active
      setAdRefreshTrigger((prev) => prev + 1);
    }
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    }
  };

  return (
    <div
      aria-label={title ? `${title} promotions` : 'Promotional banner'}
      aria-roledescription="carousel"
      className={`relative w-full overflow-hidden rounded-xl shadow-sm border border-store-border bg-store-background ${className}`}
      onKeyDown={onKeyDown}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="region"
      tabIndex={0}
      {...autoplay.containerHandlers}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide, idx) => {
          const isCategoryHero = Boolean(categoryImage) && idx === 0;
          return (
            <div
              key={slide.id}
              className="w-full h-full shrink-0 relative"
              aria-hidden={idx !== currentSlide}
              // `inert` removes the entire subtree from the accessibility tree,
              // tab order, and click/pointer events while the slide is hidden.
              // React 19 forwards this attribute to the DOM as a boolean.
              inert={idx !== currentSlide}
              role="group"
              aria-roledescription="slide"
              aria-label={`Slide ${idx + 1}: ${slide.title ?? 'Sponsored placement'}`}
            >
              {slide.type === 'image' ? (
                <div className="w-full h-full relative overflow-hidden group">
                  <Image
                    src={slide.imageUrl || ''}
                    alt={slide.title || 'Featured collection'}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px"
                    className="object-cover transition-transform duration-500 ease-out group-hover:scale-105"
                    loading={isCategoryHero ? 'eager' : 'lazy'}
                    fetchPriority={isCategoryHero ? 'high' : 'low'}
                  />
                  <div className="absolute inset-0 bg-linear-to-r from-store-primary/85 to-transparent flex flex-col justify-center px-8 md:px-16">
                    <h3 className={PROMO_TITLE}>{slide.title}</h3>
                    <p className={PROMO_SUBTITLE}>{slide.subtitle}</p>
                    {slide.link ? (
                      <Link
                        href={asRoute(getHref(slide.link))}
                        className={PROMO_CTA}
                      >
                        Shop Now
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : slide.type === 'promo' ? (
                <div className="w-full h-full relative overflow-hidden bg-linear-to-r from-store-primary to-store-accent">
                  <div className={PROMO_TEXT_PANEL}>
                    <h3 className={PROMO_TITLE}>{slide.title}</h3>
                    <p className={PROMO_SUBTITLE}>{slide.subtitle}</p>
                    {slide.link ? (
                      <Link
                        href={asRoute(getHref(slide.link))}
                        className={PROMO_CTA}
                      >
                        Shop Now
                      </Link>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-50 relative">
                  {/* Neutral, non-brand chrome for the sponsored slot (allowed
                      exception to the themed-color rule). */}
                  <span className="absolute top-2 right-2 text-[10px] text-gray-400 border border-gray-200 px-1 rounded">
                    Sponsored
                  </span>
                  <div className="transform scale-90 md:scale-100 w-full flex justify-center">
                    <AdUnit
                      placementKey={slide.adPlacement}
                      className="my-0"
                      isActive={idx === currentSlide}
                      bootDelayMs={SPONSORED_SLIDE_AD_BOOT_DELAY_MS}
                      refreshKey={adRefreshTrigger}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1.5 z-10">
        {slides.map((slide, idx) => {
          const isCurrentSlide = idx === currentSlide;
          const isActiveAdSlide = slide.type === 'ad' && isCurrentSlide;

          return (
            <button
              key={slide.id}
              type="button"
              aria-label={`Go to banner slide ${idx + 1}: ${slide.title ?? 'Sponsored placement'}`}
              aria-current={isCurrentSlide ? 'true' : undefined}
              onClick={() => setCurrentSlide(idx)}
              className="group flex h-11 min-w-11 items-center justify-center rounded-full"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                  isCurrentSlide
                    ? 'w-6'
                    : 'w-1.5 group-hover:bg-store-on-primary/70'
                } ${slide.type === 'ad' && !isCurrentSlide ? 'opacity-30' : 'opacity-100'}`}
                style={{
                  backgroundColor: isCurrentSlide
                    ? isActiveAdSlide
                      ? 'var(--store-primary, #dc2626)'
                      : 'var(--store-on-primary, #ffffff)'
                    : 'color-mix(in srgb, var(--store-on-primary, #ffffff) 40%, transparent)',
                }}
              />
            </button>
          );
        })}
        {autoplay.prefersReducedMotion ? null : (
          <CarouselPlayToggle
            isPlaying={autoplay.isPlaying}
            onToggle={autoplay.toggle}
          />
        )}
      </div>
    </div>
  );
};
