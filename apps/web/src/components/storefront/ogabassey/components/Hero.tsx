import type React from 'react';
import { GadgetPattern } from './GadgetPattern';
import { HeroDesktopGrid } from './hero-desktop-grid';
import { HeroMobileCarousel } from './hero-mobile-carousel';
import { HeroUtilityPanel } from './hero-utility-panel';
import type { LaunchProductSlide } from './LaunchCarousel';

interface HeroProps {
  /** Launch products (pinned A27/Power 80, then newest), pre-selected upstream.
   *  Drives both the mobile carousel and the desktop grid; each card deep-links
   *  to its PDP. Server-rendered so the links are crawlable; the first image of
   *  each viewport is the eager LCP element (mobile is also covered by the baked
   *  PPR shell banner). */
  slides: LaunchProductSlide[];
}

export const Hero: React.FC<HeroProps> = ({ slides }) => {
  return (
    <div className="w-full bg-white relative">
      <h1 className="sr-only">
        OgaBassey - Buy Phones, Laptops, Gaming Consoles & More. Pay Later in
        Nigeria
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
        <HeroMobileCarousel slides={slides} />
        <HeroDesktopGrid slides={slides} />
      </section>

      <HeroUtilityPanel />
    </div>
  );
};
