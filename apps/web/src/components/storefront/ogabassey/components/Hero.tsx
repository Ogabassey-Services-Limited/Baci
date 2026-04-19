'use client';

import dynamic from 'next/dynamic';
import type React from 'react';
import { useEffect, useState } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { HeroMobileCarousel } from './hero-mobile-carousel';
import { HeroUtilityPanel } from './hero-utility-panel';

const desktopHeroFallback = (
  <div
    aria-hidden="true"
    className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-4 h-auto lg:h-[540px] order-2"
  >
    <div className="lg:col-span-3 h-[400px] lg:h-full rounded-2xl bg-[linear-gradient(135deg,#f5f5f7,#e5e7eb)] ring-1 ring-black/5" />
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

export const Hero: React.FC = () => {
  const [isDesktopViewport, setIsDesktopViewport] = useState(false);
  const [hasResolvedViewport, setHasResolvedViewport] = useState(false);
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath;

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

  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath || ''}${path === '/' ? '' : path}`;

  return (
    <div className="w-full bg-white relative">
      <h1 className="sr-only">
        OgaBassey - Buy Phones, Laptops, Gaming Consoles & More. Pay Later in Nigeria
      </h1>

      <div
        id="hero-bg-extension"
        className="absolute top-0 left-0 right-0 h-14 bg-[#0F0F0F] z-0 md:hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-0 bg-gradient-to-b from-white/10 via-white/5 to-transparent" />
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
