'use client';

import dynamic from 'next/dynamic';
import { getImageProps } from 'next/image';
import type React from 'react';
import { useEffect, useState } from 'react';
import { joinRouteBasePath } from '@/lib/routes';
import { GadgetPattern } from './GadgetPattern';
import { DESKTOP_IPHONE_SLIDES } from './hero-data';
import { TRANSPARENT_PIXEL_SRC } from './hero-mobile-image-config';
import { HeroMobileCarousel } from './hero-mobile-carousel';
import { HeroUtilityPanel } from './hero-utility-panel';

const DESKTOP_HERO_IMAGE_WIDTH = 1600;
const DESKTOP_HERO_IMAGE_HEIGHT = 900;
const DESKTOP_HERO_IMAGE_SIZES = '(max-width: 1024px) 100vw, 75vw';
const DESKTOP_HERO_SOURCE_MEDIA = '(min-width: 768px)';
const desktopHeroFallbackSlide = DESKTOP_IPHONE_SLIDES[0];

function DesktopHeroFallbackImage() {
  if (!desktopHeroFallbackSlide?.fallbackImage || !desktopHeroFallbackSlide.image) {
    return null;
  }

  const alt = `${desktopHeroFallbackSlide.title} ${desktopHeroFallbackSlide.subtitle}`;
  const {
    props: {
      sizes: fallbackSizes,
      src: fallbackSrc,
      srcSet: fallbackSrcSet,
      ...imgProps
    },
  } = getImageProps({
    alt,
    // This is the viewport-scoped desktop LCP fallback image. Keep decode
    // priority aligned with the existing mobile LCP shell image.
    decoding: 'sync',
    fetchPriority: 'high',
    height: DESKTOP_HERO_IMAGE_HEIGHT,
    loading: 'eager',
    sizes: DESKTOP_HERO_IMAGE_SIZES,
    src: desktopHeroFallbackSlide.fallbackImage,
    unoptimized: true,
    width: DESKTOP_HERO_IMAGE_WIDTH,
  });

  return (
    <picture className="absolute inset-0 block h-full w-full">
      <source
        media={DESKTOP_HERO_SOURCE_MEDIA}
        sizes={DESKTOP_HERO_IMAGE_SIZES}
        srcSet={desktopHeroFallbackSlide.image}
        type="image/avif"
      />
      <source
        media={DESKTOP_HERO_SOURCE_MEDIA}
        sizes={fallbackSizes ?? DESKTOP_HERO_IMAGE_SIZES}
        srcSet={fallbackSrcSet ?? fallbackSrc}
        type="image/jpeg"
      />
      <img
        {...imgProps}
        alt={alt}
        className="h-full w-full object-cover object-center"
        src={TRANSPARENT_PIXEL_SRC}
      />
    </picture>
  );
}

const desktopHeroFallback = (
  <div
    aria-hidden="true"
    className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-4 h-auto lg:h-[540px] order-2"
  >
    <div className="relative overflow-hidden lg:col-span-3 h-[400px] lg:h-full rounded-2xl bg-[linear-gradient(135deg,#f5f5f7,#e5e7eb)] ring-1 ring-black/5">
      <DesktopHeroFallbackImage />
    </div>
    <div className="hidden lg:flex lg:col-span-1 flex-col gap-4 h-full">
      <div className="flex-1 rounded-2xl bg-gray-100 ring-1 ring-black/5" />
      <div className="flex-1 rounded-2xl bg-gray-100 ring-1 ring-black/5" />
    </div>
  </div>
);

const DeferredHeroDesktopGrid = dynamic(
  () => import('./hero-desktop-grid').then((mod) => mod.HeroDesktopGrid),
  { ssr: false, loading: () => desktopHeroFallback }
);

interface HeroProps {
  basePath?: string;
}

export const Hero: React.FC<HeroProps> = ({ basePath = '' }) => {
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [hasResolvedViewport, setHasResolvedViewport] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(min-width: 768px)');
    const syncViewport = () => {
      setIsDesktopViewport(mediaQuery.matches);
      setHasResolvedViewport(true);
    };

    syncViewport();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', syncViewport);
      return () => {
        mediaQuery.removeEventListener('change', syncViewport);
      };
    }

    mediaQuery.addListener(syncViewport);
    return () => {
      mediaQuery.removeListener(syncViewport);
    };
  }, []);

  const getHref = (path: string) => joinRouteBasePath(basePath, path);

  return (
    <div className="w-full bg-white relative">
      <h1 className="sr-only">
        OgaBassey - Buy Phones, Laptops, Gaming Consoles & More. Pay Later in Nigeria
      </h1>

      <div
        id="hero-bg-extension"
        className="absolute top-0 left-0 right-0 h-28 overflow-hidden bg-[var(--ogabassey-shell-background)] z-0 md:hidden"
        data-ogabassey-mobile-hero-bg-extension="true"
        aria-hidden="true"
      >
        <GadgetPattern opacity={0.1} />
      </div>

      <section className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 pt-4 md:pt-6 flex flex-col">
        <HeroMobileCarousel
          getHref={getHref}
          hasResolvedViewport={hasResolvedViewport}
          isDesktopViewport={isDesktopViewport}
        />

        {hasResolvedViewport && isDesktopViewport ? (
          <DeferredHeroDesktopGrid getHref={getHref} />
        ) : (
          desktopHeroFallback
        )}
      </section>

      <HeroUtilityPanel />
    </div>
  );
};
