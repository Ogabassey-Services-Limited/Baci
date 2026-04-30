'use client';

import { Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { asRoute } from '@/lib/routes';
import { AdUnit } from './AdUnit';
import { useDeferredActivation } from './deferred-shell-feature';
import { MOBILE_SLIDES } from './hero-data';

interface HeroMobileCarouselProps {
  getHref: (path: string) => string;
  hasResolvedViewport: boolean;
  isDesktopViewport: boolean;
}

export function HeroMobileCarousel({
  getHref,
  hasResolvedViewport,
  isDesktopViewport,
}: HeroMobileCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [adRefreshTrigger, setAdRefreshTrigger] = useState(0);
  const isMobileAutoplayReady = useDeferredActivation({
    enabled: hasResolvedViewport && !isDesktopViewport,
    timeoutMs: 15000,
    activateOnIdle: false,
    activateOnInteraction: true,
  });

  useEffect(() => {
    if (!isMobileAutoplayReady) {
      return;
    }

    const activeSlide = MOBILE_SLIDES[currentSlide];

    if (activeSlide?.type === 'ad') {
      setAdRefreshTrigger((prev) => prev + 1);
      return;
    }

    const timer = window.setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % MOBILE_SLIDES.length);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [currentSlide, isMobileAutoplayReady]);

  return (
    <div className="md:hidden mb-4 relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-black/5 order-1 bg-gray-100">
      {MOBILE_SLIDES.map((slide, index) => (
        <div
          key={slide.id}
          className={`absolute inset-0 transition-opacity [transition-duration:400ms] ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'} ${slide.bgClass}`}
        >
          {slide.type === 'image' && (
            <>
              <div className="relative h-full flex items-center p-6 z-10">
                <div className={`max-w-[55%] ${slide.textColor}`}>
                  <h2 className="text-2xl font-extrabold leading-tight mb-2 drop-shadow-sm font-sans">
                    {slide.title}
                  </h2>
                  <p className="text-[11px] font-medium leading-relaxed opacity-90">
                    {slide.subtitle}
                  </p>
                  <Link
                    href={asRoute(getHref('/products'))}
                    prefetch={false}
                    className={`mt-3 inline-flex min-h-11 items-center justify-center text-xs font-bold px-5 py-2 rounded-full shadow-sm transition-all border ${slide.textColor === 'text-white' ? 'bg-white/20 hover:bg-white/30 border-white/30 text-white' : 'bg-black/5 hover:bg-black/10 border-black/10 text-gray-900'}`}
                  >
                    Shop Now
                  </Link>
                </div>
              </div>
              {slide.src ? (
                <div className="absolute inset-0 z-0">
                  <div
                    className={`relative w-full h-full ${slide.imageFit === 'contain' ? 'w-[50%] ml-auto' : 'w-full'}`}
                  >
                    <Image
                      src={slide.src}
                      alt={slide.title || 'Hero slide'}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className={
                        slide.imageFit === 'contain'
                          ? 'object-contain object-right'
                          : 'object-cover'
                      }
                      priority={slide.id === 1}
                      // Lighthouse did not see a high fetch priority from priority alone with the custom loader.
                      fetchPriority={slide.id === 1 ? 'high' : undefined}
                      quality={70}
                    />
                  </div>
                </div>
              ) : null}
            </>
          )}

          {slide.type === 'video' && (
            <>
              <div className="absolute inset-0">
                {slide.poster && (
                  <Image
                    src={slide.poster}
                    alt={slide.title || 'Promotional video'}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                )}
                {index === currentSlide && (
                  <video
                    src={slide.src}
                    poster={slide.poster}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    loop
                    playsInline
                    preload="none"
                    aria-label={slide.title || 'Promotional video'}
                  >
                    {slide.captions && (
                      <track
                        kind="captions"
                        src={slide.captions}
                        label="English"
                        default
                      />
                    )}
                  </video>
                )}
              </div>
              <div className="absolute inset-0 bg-black/30 z-[1]" />
              <div className="relative h-full flex flex-col justify-center p-6 z-10 text-white">
                <span className="bg-primary text-white text-[9px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse w-fit mb-2">
                  Live Demo
                </span>
                <h2 className="text-2xl font-extrabold leading-tight mb-1">
                  {slide.title}
                </h2>
                <p className="text-xs opacity-90 mb-3">{slide.subtitle}</p>
                <button
                  className="text-xs font-bold px-4 py-2 rounded-full bg-white text-black flex min-h-10 items-center gap-1 w-fit"
                  aria-label="Watch video demo"
                >
                  <Play size={10} fill="currentColor" aria-hidden="true" />
                  Watch
                </button>
              </div>
            </>
          )}

          {slide.type === 'ad' && (
            <div className="w-full h-full flex items-center justify-center bg-gray-50 relative">
              <div className="absolute top-2 right-2 text-[8px] text-gray-400 border border-gray-200 px-1 rounded">
                Sponsored
              </div>
              <div className="w-full h-full flex items-center justify-center transform scale-90">
                <AdUnit
                  placementKey="HEADER_LEADERBOARD"
                  className="my-0"
                  isActive={index === currentSlide}
                  refreshKey={adRefreshTrigger}
                />
              </div>
            </div>
          )}
        </div>
      ))}

      <div className="absolute bottom-3 left-6 flex gap-1.5 z-20">
        {MOBILE_SLIDES.map((slide, idx) => {
          const isActive = currentSlide === idx;
          const isWhiteText =
            slide.type !== 'ad' && slide.textColor === 'text-white';

          return (
            <button
              key={slide.id}
              type="button"
              onClick={() => setCurrentSlide(idx)}
              className="flex h-8 min-w-8 items-center justify-center rounded-full cursor-pointer"
              aria-label={`Go to hero slide ${idx + 1}`}
            >
              <span
                className={`block h-1 rounded-full transition-[width,background-color] duration-300 ${isActive
                  ? isWhiteText
                    ? 'w-5 bg-white'
                    : 'w-5 bg-gray-900'
                  : isWhiteText
                    ? 'w-1.5 bg-white/40'
                    : 'w-1.5 bg-gray-900/20'
                  }`}
              />
            </button>
          );
        })}
      </div>
    </div>
  );
}
