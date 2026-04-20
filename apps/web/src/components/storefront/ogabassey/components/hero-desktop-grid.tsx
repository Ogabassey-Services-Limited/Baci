'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { asRoute } from '@/lib/routes';
import { DESKTOP_IPHONE_SLIDES } from './hero-data';

interface HeroDesktopGridProps {
  getHref: (path: string) => string;
}

export function HeroDesktopGrid({ getHref }: HeroDesktopGridProps) {
  const [currentIphoneSlide, setCurrentIphoneSlide] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCurrentIphoneSlide(
        (prev) => (prev + 1) % DESKTOP_IPHONE_SLIDES.length
      );
    }, 5000);

    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-4 h-auto lg:h-[540px] order-2">
      <div className="relative overflow-hidden rounded-2xl group cursor-pointer lg:col-span-3 h-[400px] lg:h-full bg-gray-50 flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 ring-1 ring-black/5">
        {DESKTOP_IPHONE_SLIDES.map((slide, idx) => (
          <div
            key={slide.id}
            className={`absolute inset-0 transition-opacity [transition-duration:400ms] ease-in-out ${idx === currentIphoneSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <div
              className={`absolute inset-0 z-10 bg-gradient-to-r ${slide.theme === 'dark'
                ? 'from-black/90 via-black/40 to-transparent'
                : 'from-[#e4e4e6] via-[#e4e4e6]/60 to-transparent'
                }`}
            />

            <div
              className={`relative z-20 flex flex-col justify-center h-full px-12 lg:px-20 ${slide.theme === 'dark' ? 'text-white' : 'text-gray-900'
                }`}
            >
              <div className="max-w-lg space-y-4 transform translate-x-0 transition-transform duration-700">
                <h2 className="text-6xl lg:text-8xl font-bold tracking-tighter leading-none">
                  {slide.title}
                </h2>
                <p className="text-4xl lg:text-5xl font-light opacity-90 tracking-tight">
                  {slide.subtitle}
                </p>

                <div className="pt-8">
                  <div className="h-1.5 w-20 bg-primary rounded-full mb-6" />
                  <p className="text-2xl font-medium tracking-wide opacity-80 font-serif italic">
                    {slide.headline}
                    <span className="block font-sans font-black not-italic text-3xl lg:text-4xl uppercase tracking-widest mt-1">
                      {slide.headlineSuffix}
                    </span>
                  </p>
                </div>

                <Link
                  href={asRoute(getHref('/products'))}
                  prefetch={false}
                  className="mt-8 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:shadow-primary/30 transition-all active:scale-95 inline-block"
                >
                  Shop Now
                </Link>
              </div>
            </div>

            <div className="absolute inset-0 w-full h-full z-0">
              <Image
                src={slide.image}
                alt={`${slide.title} ${slide.subtitle}`}
                fill
                sizes="(max-width: 1024px) 100vw, 75vw"
                className="object-cover object-center transition-transform [transition-duration:3000ms] ease-out scale-100 group-hover:scale-105"
                loading={idx === 0 ? 'eager' : 'lazy'}
                fetchPriority={idx === 0 ? 'high' : undefined}
                quality={70}
              />
            </div>
          </div>
        ))}

        <div className="absolute bottom-8 left-12 lg:left-20 flex gap-3 z-30">
          {DESKTOP_IPHONE_SLIDES.map((slide, idx) => (
            <button
              key={slide.id}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setCurrentIphoneSlide(idx);
              }}
              className={`h-2 rounded-full transition-all duration-300 backdrop-blur-sm ${idx === currentIphoneSlide
                ? 'w-10 bg-primary'
                : 'w-3 bg-gray-400/50 hover:bg-gray-400 hover:w-5'
                }`}
              aria-label={`Go to slide ${idx + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-4 h-full lg:col-span-1">
        <div className="flex-1 relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 bg-black">
          <Image
            src="https://cdn.ogabassey.com/products/new-arrivals-banner.avif"
            alt="MacBook Pro"
            fill
            sizes="(max-width: 1024px) 100vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105 z-0"
            loading="lazy"
            quality={60}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />

          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[120px] font-bold text-white/5 pointer-events-none select-none leading-none z-10">
            M4
          </div>

          <div className="relative z-20 flex flex-col items-center text-center p-6 h-full justify-between">
            <div>
              <p className="text-[9px] font-bold tracking-[0.2em] uppercase mb-1 text-gray-400">
                WORKFLOW
              </p>
              <h2 className="text-3xl font-bold leading-tight text-white">
                MacBook <span className="font-light block text-2xl">Pro</span>
              </h2>
            </div>

            <div className="pb-1">
              <Link
                href={asRoute(getHref('/products'))}
                prefetch={false}
                className="inline-block px-4 py-1.5 border border-white/30 rounded-full text-white text-[10px] font-bold hover:bg-white hover:text-black transition-colors"
              >
                View Specs
              </Link>
            </div>
          </div>
        </div>

        <div className="flex-1 relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 bg-[#2D0C7E]">
          <Image
            src="https://cdn.ogabassey.com/products/flash-sale-banner.avif"
            alt="PS5 Controller"
            fill
            sizes="(max-width: 1024px) 100vw, 25vw"
            className="object-cover transition-transform duration-700 group-hover:scale-105 z-0 opacity-80"
            loading="lazy"
            quality={60}
          />
          <div className="absolute inset-0 bg-gradient-to-tr from-[#2D0C7E] via-[#2D0C7E]/60 to-transparent z-10" />

          <div className="absolute left-[-20px] bottom-10 text-[80px] font-bold text-white/5 -rotate-90 pointer-events-none select-none z-10 tracking-widest">
            PLAYSTATION
          </div>

          <div className="relative z-20 flex flex-col items-center text-center p-6 h-full justify-between">
            <div>
              <h2 className="text-3xl font-bold leading-tight text-white mb-1">
                PS5 Pro
              </h2>
              <p className="text-white/70 text-sm font-light">Edition</p>
            </div>

            <p className="text-[10px] text-white/60 mb-2 uppercase tracking-widest">
              Elevate Your Game
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
