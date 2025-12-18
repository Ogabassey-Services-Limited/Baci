'use client';

// Migrated from temp-source/components/BannerCarousel.tsx
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useEffect, useMemo, useState } from 'react';
import type { AD_CONFIG } from '../config/ads';
import { AdUnit } from './AdUnit';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { asRoute } from '@/lib/routes';

interface BannerSlide {
  id: number;
  type: 'image' | 'ad';
  imageUrl?: string;
  adPlacement?: keyof typeof AD_CONFIG;
  title?: string;
  subtitle?: string;
  link?: string;
  bgColor?: string;
  textColor?: string;
}

const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 1,
    type: 'image',
    imageUrl: '/flash-sale-banner.png',
    title: 'Flash Sale',
    subtitle: 'Up to 50% Off Selected Items',
    bgColor: 'bg-red-600',
    textColor: 'text-white',
  },
  {
    id: 2,
    type: 'ad',
    adPlacement: 'HEADER_LEADERBOARD',
  },
  {
    id: 3,
    type: 'image',
    imageUrl: '/new-arrivals-banner.png',
    title: 'New Arrivals',
    subtitle: 'Check out the latest tech',
    bgColor: 'bg-black',
    textColor: 'text-white',
  },
];

interface BannerCarouselProps {
  className?: string;
  categoryImage?: string | null;
  title?: string;
  description?: string;
}

export const BannerCarousel: React.FC<BannerCarouselProps> = ({
  className = 'h-40 md:h-52',
  categoryImage,
  title,
  description,
}) => {
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath;

  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath || ''}${path === '/' ? '' : path}`;

  const [currentSlide, setCurrentSlide] = useState(0);

  // Dynamic slides based on props
  const slides = useMemo(() => {
    if (categoryImage) {
      const customSlide: BannerSlide = {
        id: 0,
        type: 'image',
        imageUrl: categoryImage,
        title: title || 'Shop Now',
        subtitle: description || 'Explore our best collection',
        bgColor: 'bg-black', // Default for category headers
        textColor: 'text-white',
      };
      return [customSlide, ...BANNER_SLIDES];
    }
    return BANNER_SLIDES;
  }, [categoryImage, title, description]);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, [slides.length]); // Depend on slides length

  return (
    <div
      className={`relative w-full overflow-hidden rounded-xl shadow-sm border border-gray-100 bg-white ${className}`}
    >
      <div
        className="flex h-full transition-transform duration-700 ease-in-out"
        style={{ transform: `translateX(-${currentSlide * 100}%)` }}
      >
        {slides.map((slide) => (
          <div key={slide.id} className="w-full h-full flex-shrink-0 relative">
            {slide.type === 'image' ? (
              <div className="w-full h-full relative overflow-hidden group">
                <Image
                  src={slide.imageUrl || ''}
                  alt={slide.title || 'Banner'}
                  fill
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 80vw, 1400px"
                  className="object-cover transition-transform duration-1000 group-hover:scale-105"
                  priority={slide.id === 1}
                />
                <div
                  className={`absolute inset-0 bg-gradient-to-r ${slide.bgColor === 'bg-black' ? 'from-black/80' : 'from-red-900/80'} to-transparent flex flex-col justify-center px-8 md:px-16`}
                >
                  <h3
                    className={`text-2xl md:text-4xl font-bold ${slide.textColor} mb-2 leading-tight line-clamp-1`}
                  >
                    {slide.title}
                  </h3>
                  <p
                    className={`text-sm md:text-lg ${slide.textColor} opacity-90 max-w-md line-clamp-2`}
                  >
                    {slide.subtitle}
                  </p>
                  {slide.link && (
                    <Link
                      href={asRoute(getHref(slide.link))}
                      className="mt-4 px-6 py-2 bg-white text-gray-900 text-xs md:text-sm font-bold rounded-full w-fit hover:bg-gray-100 transition-colors shadow-lg active:scale-95 inline-block"
                    >
                      Shop Now
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-gray-50 relative">
                <span className="absolute top-2 right-2 text-[10px] text-gray-400 border border-gray-200 px-1 rounded">
                  Sponsored
                </span>
                <div className="transform scale-90 md:scale-100 w-full flex justify-center">
                  {/* We ensure the ad unit doesn't overflow */}
                  <AdUnit placementKey={slide.adPlacement!} className="my-0" />
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-10">
        {slides.map((slide, idx) => (
          <button
            key={idx}
            onClick={() => setCurrentSlide(idx)}
            className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${idx === currentSlide
              ? 'w-6 bg-white'
              : 'w-1.5 bg-white/40 hover:bg-white/70'
              }`}
            style={{
              backgroundColor:
                slide.type === 'ad' && idx === currentSlide
                  ? '#DC2626'
                  : undefined, // Red indicator for ad slide active state if visible
              opacity: slide.type === 'ad' && idx !== currentSlide ? 0.3 : 1,
            }}
          />
        ))}
      </div>
    </div>
  );
};
