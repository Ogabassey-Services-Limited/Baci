import { Gamepad2 } from 'lucide-react';
import Image from 'next/image';
import type React from 'react';
import { RotatingWord } from './rotating-word';

export const Hero: React.FC = () => {
  return (
    <div className="bg-white">
      <section className="max-w-[1400px] mx-auto px-4 md:px-6 pt-24 md:pt-32 pb-4 md:pb-8">
        {/* Main Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 h-auto lg:h-[500px]">
          {/* 1. Main Hero Banner (Spans 3 Columns) */}
          <div className="lg:col-span-3 relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300">
            <Image
              src="https://cdn.ogabassey.com/products/new-arrivals-banner.avif"
              alt="VR Headset"
              fill
              priority
              sizes="(max-width: 1024px) 100vw, 75vw"
              className="object-cover transition-transform duration-700 group-hover:scale-105 z-0"
            />
            <div className="absolute inset-0 bg-linear-to-r from-black/80 via-black/40 to-transparent z-10" />

            <div className="relative z-20 flex flex-col justify-center h-full p-8 md:p-12 max-w-2xl">
              <span className="inline-block px-3 py-1 bg-red-600 text-white text-xs font-bold uppercase tracking-wider rounded-full w-fit mb-4 animate-in fade-in slide-in-from-left-4 duration-500">
                New Arrival
              </span>
              <h1 className="text-4xl md:text-6xl font-bold text-white mb-4 leading-tight animate-in fade-in slide-in-from-left-4 duration-700 delay-100">
                Experience <br />
                <span className="text-transparent bg-clip-text bg-linear-to-r from-red-500 to-orange-500">
                  Next Gen
                </span>{' '}
                VR
              </h1>
              <p className="text-gray-300 text-lg mb-8 max-w-md animate-in fade-in slide-in-from-left-4 duration-700 delay-200">
                Immerse yourself in stunning 4K resolution with the latest
                virtual reality technology.
              </p>
              <div className="flex gap-4 animate-in fade-in slide-in-from-left-4 duration-700 delay-300">
                <button type="button" className="px-8 py-3 bg-white text-gray-900 font-bold rounded-full hover:bg-gray-100 transition-colors shadow-lg active:scale-95">
                  Shop Now
                </button>
                <button type="button" className="px-8 py-3 bg-white/10 backdrop-blur-md text-white font-bold rounded-full hover:bg-white/20 transition-colors border border-white/30 active:scale-95">
                  Learn More
                </button>
              </div>

              {/* Floating Elements (Decorative) */}
              <div className="absolute right-10 bottom-10 flex gap-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className={`w-2 h-2 rounded-full bg-white/50 animate-pulse`}
                    style={{ animationDelay: `${i * 200}ms` }}
                  />
                ))}
              </div>
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
                priority
                sizes="(max-width: 1024px) 100vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105 z-0"
              />
              <div className="absolute inset-0 bg-linear-to-t from-black via-black/40 to-transparent z-10" />

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
                  <span className="inline-block px-4 py-1.5 border border-white/30 rounded-full text-white text-[10px] font-bold hover:bg-white hover:text-black transition-colors">
                    View Specs
                  </span>
                </div>
              </div>
            </div>

            {/* 2b. Bottom Unit: PS5 Promo */}
            <div className="flex-1 relative overflow-hidden rounded-2xl group cursor-pointer shadow-lg hover:shadow-xl transition-all duration-300 bg-[#2D0C7E]">
              <Image
                src="https://cdn.ogabassey.com/products/flash-sale-banner.avif"
                alt="PS5 Controller"
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 25vw"
                className="object-cover transition-transform duration-700 group-hover:scale-105 z-0 opacity-80"
              />
              <div className="absolute inset-0 bg-linear-to-tr from-[#2D0C7E] via-[#2D0C7E]/60 to-transparent z-10" />

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
      <div className="w-full bg-white mt-4 md:mt-12 mb-8 border-y border-gray-100 py-6">
        <div className="max-w-[1400px] mx-auto px-4 md:px-6 flex flex-col md:flex-row items-center justify-between gap-6 md:gap-0">
          {/* Left Promo Message */}
          <div className="bg-red-50 px-10 py-8 rounded-lg min-w-[280px] text-center xl:text-left xl:translate-x-[-5%]">
            <span className="text-gray-900 font-medium text-xl">
              We Pay <span className="text-red-600 font-bold">YOU</span> When
            </span>
          </div>

          {/* Icons */}
          <div className="flex justify-center gap-8 md:gap-12 flex-wrap">
            <div className="flex flex-col items-center gap-2 group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-red-50 text-red-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
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
              <span className="text-xs font-bold text-gray-700">Airtime</span>
            </div>
            <div className="flex flex-col items-center gap-2 group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
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
              <span className="text-xs font-bold text-gray-700">Data</span>
            </div>
            <div className="flex flex-col items-center gap-2 group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
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
              <span className="text-xs font-bold text-gray-700">Tv</span>
            </div>
            <div className="flex flex-col items-center gap-2 group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
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
              <span className="text-xs font-bold text-gray-700">Power</span>
            </div>
            <div className="flex flex-col items-center gap-2 group cursor-pointer">
              <div className="w-12 h-12 rounded-full bg-gray-50 text-gray-600 flex items-center justify-center group-hover:bg-red-600 group-hover:text-white transition-all duration-300">
                <Gamepad2 size={20} />
              </div>
              <span className="text-xs font-bold text-gray-700">Betting</span>
            </div>
          </div>

          {/* Right Promo Message - HIDDEN ON MOBILE */}
          <div className="hidden md:block bg-[#FFF5F5] px-10 py-8 rounded-lg min-w-[280px] text-center xl:text-right xl:translate-x-[5%]">
            <span className="text-gray-900 font-medium text-xl">
              You Buy <RotatingWord />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
