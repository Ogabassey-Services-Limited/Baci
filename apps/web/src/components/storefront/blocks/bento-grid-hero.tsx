'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { asRoute } from '@/lib/routes';
import { cn } from '@/lib/utils';

export interface BentoGridHeroProps {
  images: {
    src: string;
    alt: string;
    title?: string;
    subtitle?: string;
    ctaText?: string;
    ctaLink?: string;
    textColor?: string; // e.g., 'text-white' or 'text-black'
  }[];
  height?: 'small' | 'medium' | 'large';
}

export function BentoGridHero({
  images = [],
  height = 'medium',
}: BentoGridHeroProps) {
  // Ensure we have at least 3 images, or fallback to placeholders if empty
  // In a real app, you might want to handle fewer images gracefully
  const safeImages = [
    images[0] || { src: '', alt: 'Hero 1' },
    images[1] || { src: '', alt: 'Hero 2' },
    images[2] || { src: '', alt: 'Hero 3' },
  ];

  const heightClasses = {
    small: 'h-[400px] md:h-[500px]',
    medium: 'h-[500px] md:h-[600px]',
    large: 'h-[600px] md:h-[700px]',
  };

  return (
    <section
      className={cn('container mx-auto px-4 py-6', heightClasses[height])}
    >
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-full">
        {/* Main Hero (Left - Spans 2 cols on desktop) */}
        <div className="md:col-span-2 relative rounded-2xl overflow-hidden group h-full">
          <Link
            href={asRoute(safeImages[0].ctaLink || '#')}
            className="block w-full h-full"
          >
            <Image
              src={safeImages[0].src}
              alt={safeImages[0].alt}
              fill
              className="object-cover transition-transform duration-700 group-hover:scale-105"
              priority
              sizes="(max-width: 768px) 100vw, 66vw"
            />
            <div className="absolute inset-0 bg-linear-to-t from-black/60 via-transparent to-transparent" />
            <div
              className={cn(
                'absolute bottom-8 left-8 max-w-lg',
                safeImages[0].textColor || 'text-white'
              )}
            >
              {safeImages[0].title && (
                <h2 className="text-3xl md:text-5xl font-bold mb-2 leading-tight">
                  {safeImages[0].title}
                </h2>
              )}
              {safeImages[0].subtitle && (
                <p className="text-lg md:text-xl opacity-90 mb-6 font-light">
                  {safeImages[0].subtitle}
                </p>
              )}
              {safeImages[0].ctaText && (
                <Button variant="secondary" className="rounded-full px-6">
                  {safeImages[0].ctaText}
                </Button>
              )}
            </div>
          </Link>
        </div>

        {/* Secondary Heroes (Right - Stacked) */}
        <div className="flex flex-col gap-4 h-full">
          {/* Top Right */}
          <div className="relative flex-1 rounded-2xl overflow-hidden group">
            <Link
              href={asRoute(safeImages[1].ctaLink || '#')}
              className="block w-full h-full"
            >
              <Image
                src={safeImages[1].src}
                alt={safeImages[1].alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              <div
                className={cn(
                  'absolute bottom-6 left-6',
                  safeImages[1].textColor || 'text-white'
                )}
              >
                {safeImages[1].title && (
                  <h3 className="text-2xl font-bold mb-1">
                    {safeImages[1].title}
                  </h3>
                )}
                {safeImages[1].subtitle && (
                  <p className="text-sm opacity-90">{safeImages[1].subtitle}</p>
                )}
              </div>
            </Link>
          </div>

          {/* Bottom Right */}
          <div className="relative flex-1 rounded-2xl overflow-hidden group">
            <Link
              href={asRoute(safeImages[2].ctaLink || '#')}
              className="block w-full h-full"
            >
              <Image
                src={safeImages[2].src}
                alt={safeImages[2].alt}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, 33vw"
              />
              <div className="absolute inset-0 bg-black/20 group-hover:bg-black/10 transition-colors" />
              <div
                className={cn(
                  'absolute bottom-6 left-6',
                  safeImages[2].textColor || 'text-white'
                )}
              >
                {safeImages[2].title && (
                  <h3 className="text-2xl font-bold mb-1">
                    {safeImages[2].title}
                  </h3>
                )}
                {safeImages[2].subtitle && (
                  <p className="text-sm opacity-90">{safeImages[2].subtitle}</p>
                )}
              </div>
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
