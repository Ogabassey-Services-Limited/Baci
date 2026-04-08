'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
// import { ThemedButton } from '@/components/themed';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

export interface OgabasseyHeroProps {
  slides: {
    image: string;
    title?: string;
    link?: string;
  }[];
  staticBanner1?: string;
  staticBanner2?: string;
  autoplayDelay?: number;
}

export function OgabasseyHero({
  slides = [],
  staticBanner1,
  staticBanner2,
  autoplayDelay = 5000,
}: OgabasseyHeroProps) {
  const [currentIndex, setCurrentIndex] = useState(0);

  // Auto-slide
  useEffect(() => {
    if (slides.length <= 1) return;

    const interval = setInterval(() => {
      setCurrentIndex((prev) => (prev + 1) % slides.length);
    }, autoplayDelay);

    return () => clearInterval(interval);
  }, [slides.length, autoplayDelay]);

  const goToPrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => (prev + 1) % slides.length);
  };

  if (slides.length === 0) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row w-full gap-4 h-[400px] md:h-[480px]">
        {/* Carousel section */}
        <div className="relative flex-1 h-full rounded-xl overflow-hidden group">
          <div className="relative w-full h-full">
            {slides.map((slide, index) => (
              <div
                key={slide.image}
                className={cn(
                  'absolute inset-0 w-full h-full transition-opacity duration-500 ease-in-out',
                  index === currentIndex ? 'opacity-100 z-10' : 'opacity-0 z-0'
                )}
              >
                <Link
                  href={asRoute(slide.link || '#')}
                  className="block w-full h-full relative"
                >
                  <Image
                    src={slide.image}
                    alt={slide.title || `Slide ${index + 1}`}
                    fill
                    className="object-cover"
                    priority={index === 0}
                    sizes="(max-width: 768px) 100vw, 80vw"
                  />
                </Link>
              </div>
            ))}
          </div>

          {/* Navigation Arrows */}
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  goToPrevious();
                }}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100 z-20"
                aria-label="Previous slide"
              >
                <ChevronLeft className="w-6 h-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  goToNext();
                }}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 rounded-full bg-black/30 text-white hover:bg-black/50 transition-all opacity-0 group-hover:opacity-100 z-20"
                aria-label="Next slide"
              >
                <ChevronRight className="w-6 h-6" />
              </button>

              {/* Dots navigation */}
              <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-2 z-20">
                {slides.map((slide, i) => (
                  <button
                    type="button"
                    key={`dot-${slide.image}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setCurrentIndex(i);
                    }}
                    className={cn(
                      'w-2 h-2 rounded-full transition-all',
                      currentIndex === i
                        ? 'bg-white w-6'
                        : 'bg-white/50 hover:bg-white/80'
                    )}
                    aria-label={`Go to slide ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Static images - Desktop only */}
        {(staticBanner1 || staticBanner2) && (
          <div className="hidden md:flex flex-col w-1/3 gap-4 h-full">
            {staticBanner1 && (
              <div className="relative flex-1 rounded-xl overflow-hidden">
                <Image
                  src={staticBanner1}
                  alt="Banner 1"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
            {staticBanner2 && (
              <div className="relative flex-1 rounded-xl overflow-hidden">
                <Image
                  src={staticBanner2}
                  alt="Banner 2"
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  className="object-cover hover:scale-105 transition-transform duration-500"
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
