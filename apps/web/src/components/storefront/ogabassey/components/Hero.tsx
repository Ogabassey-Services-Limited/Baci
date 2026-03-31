'use client';

// Migrated from temp-source/components/Hero.tsx
import { Gamepad2, Play } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import type React from 'react';
import { useRef, useState, useEffect } from 'react';
import { useMerchantSafe } from '@/hooks/use-merchant';
import { AdUnit } from './AdUnit';
import { asRoute } from '@/lib/routes';
import { UtilityModal } from './UtilityModal';

type SlideType = 'image' | 'video' | 'ad';

interface SlideData {
  id: number;
  type: SlideType;
  title?: string;
  subtitle?: string;
  bgClass?: string;
  src?: string; // Image URL or Video URL
  poster?: string; // Video poster
  textColor?: string;
  imageFit?: 'contain' | 'cover';
  captions?: string;
}

const MOBILE_SLIDES: SlideData[] = [
  {
    id: 1,
    type: 'image',
    title: 'iPhone 17 Pro Max',
    subtitle: 'Beyond IMAGINATION with the new nebula finish.',
    bgClass: 'bg-[#F5F5F7]',
    src: '/images/hero/iphone-17-pro-max.png',
    textColor: 'text-gray-900',
    imageFit: 'contain',
  },
  {
    id: 2,
    type: 'video',
    title: 'Cinematic Mode',
    subtitle: 'Shoot like a pro. Auto-focus changes dynamically.',
    bgClass: 'bg-black',
    src: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    poster: '/placeholder.png',
    textColor: 'text-white',
    imageFit: 'cover',
  },
  {
    id: 3,
    type: 'ad',
    bgClass: 'bg-gray-50',
  },
];

const DESKTOP_IPHONE_SLIDES = [
  {
    id: 1,
    title: 'iPhone 17',
    subtitle: 'Pro Max',
    headline: 'Beyond',
    headlineSuffix: 'IMAGINATION',
    image: '/images/hero/iphone-17-pro-max.png',
    theme: 'light',
  },
  {
    id: 2,
    title: 'Titanium',
    subtitle: 'Design',
    headline: 'Forged in',
    headlineSuffix: 'TITANIUM',
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-bluetitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
    theme: 'light',
  },
  {
    id: 3,
    title: 'A17 Pro',
    subtitle: 'Chip',
    headline: 'Monster',
    headlineSuffix: 'PERFORMANCE',
    image:
      'https://store.storeimages.cdn-apple.com/4982/as-images.apple.com/is/iphone-15-pro-finish-select-202309-6-7inch-blacktitanium?wid=5120&hei=2880&fmt=p-jpg&qlt=80&.v=1692845702708',
    theme: 'light',
  },
];



export const Hero: React.FC = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [currentIphoneSlide, setCurrentIphoneSlide] = useState(0);
  const _videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  // Utility Rotation Logic
  const utilityWords = ['Airtime!', 'Data!', 'TV!', 'Power!', 'Gaming!'];
  const [activeUtilityIndex, setActiveUtilityIndex] = useState(0);
  const [isManualUtility, setIsManualUtility] = useState(false);

  useEffect(() => {
    if (isManualUtility) return;

    const interval = setInterval(() => {
      setActiveUtilityIndex((prev) => (prev + 1) % utilityWords.length);
    }, 2500);

    return () => clearInterval(interval);
  }, [isManualUtility]);

  const [showUtilityModal, setShowUtilityModal] = useState(false);
  const [utilityTab, setUtilityTab] = useState<'airtime' | 'data' | 'tv' | 'power' | 'betting'>('airtime');
  const merchantContext = useMerchantSafe();
  const basePath = merchantContext?.basePath;

  const getHref = (path: string) =>
    path.startsWith('http') ? path : `${basePath || ''}${path === '/' ? '' : path}`;

  // Combined Auto-rotation & Ad Pause Logic for Mobile
  const [adRefreshTrigger, setAdRefreshTrigger] = useState(0);

  useEffect(() => {
    // 1. Check if current slide is an AD
    const activeSlide = MOBILE_SLIDES[currentSlide];

    if (activeSlide?.type === 'ad') {
      // Trigger ad refresh
      setAdRefreshTrigger((prev) => prev + 1);
      // DO NOT set a timer for rotation. Effectively PAUSE.
      return;
    }

    // 2. If NOT an ad, set timer for next slide
    const timer = setTimeout(() => {
      setCurrentSlide((prev) => (prev + 1) % MOBILE_SLIDES.length);
    }, 6000);

    return () => clearTimeout(timer);
  }, [currentSlide]);

  // Auto-rotate Desktop iPhone Carousel
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentIphoneSlide(
        (prev) => (prev + 1) % DESKTOP_IPHONE_SLIDES.length
      );
    }, 5000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="w-full bg-white relative">
      {/* SEO H1 - Visually hidden but accessible and indexable */}
      <h1 className="sr-only">
        OgaBassey - Buy Phones, Laptops, Gaming Consoles & More. Pay Later in Nigeria
      </h1>
      {/* Background Extension - Hidden on Desktop to allow clean separation from white navbar */}
      <div
        id="hero-bg-extension"
        className="absolute top-0 left-0 right-0 h-14 bg-[#0F0F0F] z-0 md:hidden"
      >
        <div
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='150' height='150' viewBox='0 0 150 150' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' stroke='%23ffffff' stroke-width='1.5'%3E%3Cpath d='M0 5 q5 -10 10 0 t10 0' stroke-linecap='round'/%3E%3C/g%3E%3C/svg%3E")`,
            backgroundSize: '140px 140px',
          }}
        />
      </div>

      <section className="max-w-[1400px] mx-auto px-4 md:px-6 relative z-10 pt-4 md:pt-6 flex flex-col">
        {/* MOBILE CAROUSEL */}
        <div className="md:hidden mb-4 relative rounded-2xl overflow-hidden shadow-2xl h-48 ring-1 ring-black/5 order-1 bg-gray-100">
          {MOBILE_SLIDES.map((slide, index) => (
            <div
              key={slide.id}
              className={`absolute inset-0 transition-opacity duration-[400ms] ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'} ${slide.bgClass}`}
            >
              {/* TYPE: IMAGE */}
              {slide.type === 'image' && (
                <>
                  <div className="relative h-full flex items-center p-6 z-10">
                    <div className={`max-w-[55%] ${slide.textColor}`}>
                      <h2 className="text-2xl font-extrabold leading-tight mb-2 drop-shadow-sm font-sans">
                        {slide.title}
                      </h2>
                      <p
                        className={`text-[11px] font-medium leading-relaxed opacity-90`}
                      >
                        {slide.subtitle}
                      </p>
                      <Link
                        href={asRoute(getHref('/products'))}
                        className={`mt-3 text-[10px] font-bold px-4 py-2 rounded-full shadow-sm transition-all border inline-block ${slide.textColor === 'text-white' ? 'bg-white/20 hover:bg-white/30 border-white/30 text-white' : 'bg-black/5 hover:bg-black/10 border-black/10 text-gray-900'}`}
                      >
                        Shop Now
                      </Link>
                    </div>
                  </div>
                  <div className="absolute inset-0 z-0">
                    <div className={`relative w-full h-full ${slide.imageFit === 'contain' ? 'w-[50%] ml-auto' : 'w-full'}`}>
                      <Image
                        src={slide.src || ''}
                        alt={slide.title || 'Hero slide'}
                        fill
                        sizes="(max-width: 768px) 100vw, 50vw"
                        className={slide.imageFit === 'contain' ? 'object-contain object-right' : 'object-cover'}
                        priority={slide.id === 1}
                      />
                    </div>
                  </div>
                </>
              )}

              {/* TYPE: VIDEO */}
              {slide.type === 'video' && (
                <>
                  <video
                    src={slide.src}
                    poster={slide.poster}
                    className="absolute inset-0 w-full h-full object-cover"
                    muted
                    loop
                    playsInline
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
                      className="text-[10px] font-bold px-4 py-2 rounded-full bg-white text-black flex items-center gap-1 w-fit"
                      aria-label="Watch video demo"
                    >
                      <Play size={10} fill="currentColor" aria-hidden="true" />
                      Watch
                    </button>
                  </div>
                </>
              )}

              {/* TYPE: AD */}
              {slide.type === 'ad' && (
                <div className="w-full h-full flex items-center justify-center bg-gray-50 relative">
                  <div className="absolute top-2 right-2 text-[8px] text-gray-400 border border-gray-200 px-1 rounded">
                    Sponsored
                  </div>
                  <div className="w-full h-full flex items-center justify-center transform scale-90">
                    <AdUnit
                      placementKey="HEADER_LEADERBOARD"
                      className="my-0"
                      refreshKey={adRefreshTrigger}
                    />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Indicators */}
          <div className="absolute bottom-3 left-6 flex gap-1.5 z-20">
            {MOBILE_SLIDES.map((slide, idx) => {
              const isActive = currentSlide === idx;
              const isWhiteText =
                slide.type !== 'ad' && slide.textColor === 'text-white';

              return (
                <div
                  key={idx}
                  onClick={() => setCurrentSlide(idx)}
                  className={`h-1 rounded-full transition-all duration-300 cursor-pointer ${isActive
                    ? isWhiteText
                      ? 'w-5 bg-white'
                      : 'w-5 bg-gray-900'
                    : isWhiteText
                      ? 'w-1.5 bg-white/40'
                      : 'w-1.5 bg-gray-900/20'
                    }`}
                />
              );
            })}
          </div>
        </div>

        {/* --- DESKTOP HERO GRID (RESTRUCTURED FOR 3:1 LAYOUT) --- */}
        <div className="hidden md:grid grid-cols-1 lg:grid-cols-4 gap-4 h-auto lg:h-[540px] order-2">
          {/* 1. Main Carousel - Spans 3 Columns (Large Left Area) */}
          <div className="relative overflow-hidden rounded-2xl group cursor-pointer lg:col-span-3 h-[400px] lg:h-full bg-gray-50 flex flex-col shadow-lg hover:shadow-xl transition-all duration-300 ring-1 ring-black/5">
            {DESKTOP_IPHONE_SLIDES.map((slide, idx) => (
              <div
                key={slide.id}
                className={`absolute inset-0 transition-opacity duration-[400ms] ease-in-out ${idx === currentIphoneSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
              >
                {/* Gradient Overlay for Readability */}
                <div
                  className={`absolute inset-0 z-10 bg-gradient-to-r ${slide.theme === 'dark'
                    ? 'from-black/90 via-black/40 to-transparent'
                    : 'from-[#e4e4e6] via-[#e4e4e6]/60 to-transparent'
                    }`}
                />

                {/* Content */}
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
                      className="mt-8 bg-primary hover:bg-primary/90 text-white px-8 py-3 rounded-full font-bold text-lg shadow-lg hover:shadow-primary/30 transition-all active:scale-95 inline-block"
                    >
                      Shop Now
                    </Link>
                  </div>
                </div>

                {/* Image */}
                <div className="absolute inset-0 w-full h-full z-0">
                  <Image
                    src={slide.image}
                    alt={`${slide.title} ${slide.subtitle}`}
                    fill
                    sizes="(max-width: 1024px) 100vw, 75vw"
                    className="object-cover object-center transition-transform duration-[8000ms] ease-out scale-100 group-hover:scale-105"
                    priority={idx === 0}
                  />
                </div>
              </div>
            ))}

            {/* Indicators */}
            <div className="absolute bottom-8 left-12 lg:left-20 flex gap-3 z-30">
              {DESKTOP_IPHONE_SLIDES.map((_, idx) => (
                <button
                  key={idx}
                  onClick={(e) => {
                    e.stopPropagation();
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

          {/* 2. Right Sidebar - Stacked Items (Spans 1 Column) */}
          <div className="flex flex-col gap-4 h-full lg:col-span-1">
            {/* 2a. Top Unit: MacBook Promo */}
            <div className="flex-1 relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 bg-black">
              <Image
                src="https://cdn.ogabassey.com/products/new-arrivals-banner.avif"
                alt="MacBook Pro"
                fill
                sizes="(max-width: 1024px) 100vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105 z-0"
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
                    MacBook{' '}
                    <span className="font-light block text-2xl">Pro</span>
                  </h2>
                </div>

                <div className="pb-1">
                  <Link
                    href={asRoute(getHref('/products'))}
                    className="inline-block px-4 py-1.5 border border-white/30 rounded-full text-white text-[10px] font-bold hover:bg-white hover:text-black transition-colors"
                  >
                    View Specs
                  </Link>
                </div>
              </div>
            </div>

            {/* 2b. Bottom Unit: PS5 Promo */}
            <div className="flex-1 relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 bg-[#2D0C7E]">
              <Image
                src="https://cdn.ogabassey.com/products/flash-sale-banner.avif"
                alt="PS5 Controller"
                fill
                sizes="(max-width: 1024px) 100vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105 z-0 opacity-80"
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

                <div>
                  <p className="text-[10px] text-white/60 mb-2 uppercase tracking-widest">
                    Elevate Your Game
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Utility Panel - Full Width & No Drop Shadow as requested */}
      <div className="w-full bg-white mt-3 md:mt-8 mb-6 border-y border-gray-100 md:py-5">
        {/* Mobile: Integrated Card Design */}
        <div className="md:hidden px-4">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-2">
            {/* Header Pill */}
            <div className="bg-primary/5 rounded-2xl py-3 px-4 mb-4 text-center">
              <span className="text-gray-900 font-medium text-sm">
                We Pay <span className="text-primary font-bold">YOU</span> When You Buy <span className="text-primary font-bold transition-all duration-500 inline-block min-w-[60px] text-left">{utilityWords[activeUtilityIndex]}</span>
              </span>
            </div>

            {/* Icons Grid */}
            <div className="grid grid-cols-5 gap-2 px-1 pb-2">
              <div
                onClick={() => {
                  setUtilityTab('airtime');
                  setShowUtilityModal(true);
                  setIsManualUtility(true);
                  setActiveUtilityIndex(0);
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center shadow-md transition-[background-color,color] duration-300 ${activeUtilityIndex === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 0 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Airtime</span>
              </div>
              <div
                onClick={() => {
                  setUtilityTab('data');
                  setShowUtilityModal(true);
                  setIsManualUtility(true);
                  setActiveUtilityIndex(1);
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 1 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.55a11 11 0 0 1 14.08 0" /><path d="M1.42 9a16 16 0 0 1 21.16 0" /><path d="M8.53 16.11a6 6 0 0 1 6.95 0" /><line x1="12" y1="20" x2="12.01" y2="20" />
                  </svg>
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 1 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Data</span>
              </div>
              <div
                onClick={() => {
                  setUtilityTab('tv');
                  setShowUtilityModal(true);
                  setIsManualUtility(true);
                  setActiveUtilityIndex(2);
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 2 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="7" width="20" height="15" rx="2" ry="2" /><polyline points="17 2 12 7 7 2" />
                  </svg>
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 2 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Tv</span>
              </div>
              <div
                onClick={() => {
                  setUtilityTab('power');
                  setShowUtilityModal(true);
                  setIsManualUtility(true);
                  setActiveUtilityIndex(3);
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 3 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                  </svg>
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 3 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Power</span>
              </div>
              <div
                onClick={() => {
                  setUtilityTab('betting');
                  setShowUtilityModal(true);
                  setIsManualUtility(true);
                  setActiveUtilityIndex(4);
                }}
                className="flex flex-col items-center gap-2 group cursor-pointer"
              >
                <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 4 ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                  <Gamepad2 size={20} />
                </div>
                <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 4 ? 'text-primary font-bold' : 'text-gray-700'}`}>Gaming</span>
              </div>
            </div>
          </div>
        </div>

        {/* Desktop: Original Layout */}
        <div className="hidden md:flex max-w-[1400px] mx-auto px-4 md:px-6 flex-row items-center justify-between">
          {/* Left Promo Message */}
          <div className="bg-primary/5 px-10 py-8 rounded-lg min-w-[280px] text-center xl:text-left xl:-translate-x-[5%]">
            <span className="text-gray-900 font-medium text-xl">
              We Pay <span className="text-primary font-bold">YOU</span> When
            </span>
          </div>

          {/* Icons */}
          <div className="flex justify-center gap-8 md:gap-12 flex-wrap">
            <div
              onClick={() => {
                setUtilityTab('airtime');
                setShowUtilityModal(true);
                setIsManualUtility(true);
                setActiveUtilityIndex(0);
              }}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 0 ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                </svg>
              </div>
              <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 0 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Airtime</span>
            </div>
            <div
              onClick={() => {
                setUtilityTab('data');
                setShowUtilityModal(true);
                setIsManualUtility(true);
                setActiveUtilityIndex(1);
              }}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 1 ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M5 12.55a11 11 0 0 1 14.08 0" />
                  <path d="M1.42 9a16 16 0 0 1 21.16 0" />
                  <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
                  <line x1="12" y1="20" x2="12.01" y2="20" />
                </svg>
              </div>
              <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 1 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Data</span>
            </div>
            <div
              onClick={() => {
                setUtilityTab('tv');
                setShowUtilityModal(true);
                setIsManualUtility(true);
                setActiveUtilityIndex(2);
              }}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 2 ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <rect x="2" y="7" width="20" height="15" rx="2" ry="2" />
                  <polyline points="17 2 12 7 7 2" />
                </svg>
              </div>
              <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 2 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Tv</span>
            </div>
            <div
              onClick={() => {
                setUtilityTab('power');
                setShowUtilityModal(true);
                setIsManualUtility(true);
                setActiveUtilityIndex(3);
              }}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 3 ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
                </svg>
              </div>
              <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 3 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Power</span>
            </div>
            <div
              onClick={() => {
                setUtilityTab('betting');
                setShowUtilityModal(true);
                setIsManualUtility(true);
                setActiveUtilityIndex(4);
              }}
              className="flex flex-col items-center gap-2 group cursor-pointer"
            >
              <div className={`w-12 h-12 rounded-full flex items-center justify-center transition-[background-color,color] duration-300 ${activeUtilityIndex === 4 ? 'bg-primary/10 text-primary' : 'bg-gray-50 text-gray-600 group-hover:bg-primary group-hover:text-white'}`}>
                <Gamepad2 size={20} />
              </div>
              <span className={`text-xs font-medium transition-colors duration-300 ${activeUtilityIndex === 4 ? 'text-gray-900 font-bold' : 'text-gray-700'}`}>Gaming</span>
            </div>
          </div>

          {/* Right Promo Message - HIDDEN ON MOBILE */}
          <div className="hidden md:block bg-primary/5 px-10 py-8 rounded-lg min-w-[280px] text-center xl:text-right xl:translate-x-[5%]">
            <span className="text-gray-900 font-medium text-xl">
              You Buy <span className="text-primary font-bold transition-all duration-500 inline-block min-w-[80px] text-left">{utilityWords[activeUtilityIndex]}</span>
            </span>
          </div>
        </div>
      </div>

      <UtilityModal
        isOpen={showUtilityModal}
        onClose={() => setShowUtilityModal(false)}
        initialTab={utilityTab}
      />
    </div >
  );
};
