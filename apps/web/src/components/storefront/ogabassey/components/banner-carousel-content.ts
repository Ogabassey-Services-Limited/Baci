import type { AD_CONFIG } from '../config/ads';

interface BaseBannerSlide {
  id: number;
  title?: string;
  subtitle?: string;
  link?: string;
}

export interface ImageBannerSlide extends BaseBannerSlide {
  type: 'image';
  imageUrl: string;
}

export interface PromoBannerSlide extends BaseBannerSlide {
  type: 'promo';
}

export interface AdBannerSlide extends BaseBannerSlide {
  type: 'ad';
  adPlacement: keyof typeof AD_CONFIG;
}

export type BannerSlide = ImageBannerSlide | PromoBannerSlide | AdBannerSlide;

// Promotional slides are CSS-only + theme-driven (no baked image), so they
// adapt to each merchant's brand and cost nothing on the network.
export const BANNER_SLIDES: BannerSlide[] = [
  {
    id: 1,
    type: 'promo',
    title: 'Flash Sale',
    subtitle: 'Up to 50% Off Selected Items',
  },
  {
    id: 2,
    type: 'ad',
    adPlacement: 'HEADER_LEADERBOARD',
  },
  {
    id: 3,
    type: 'promo',
    title: 'New Arrivals',
    subtitle: 'Check out the latest tech',
  },
];

export const PROMO_TEXT_PANEL =
  'absolute inset-0 flex flex-col justify-center px-8 md:px-16';
export const PROMO_TITLE =
  'text-2xl md:text-4xl font-bold text-store-on-primary mb-2 leading-tight line-clamp-1';
export const PROMO_SUBTITLE =
  'text-sm md:text-lg text-store-on-primary opacity-90 max-w-md line-clamp-2';
export const PROMO_CTA =
  'mt-4 px-6 py-2 bg-store-on-primary text-store-primary text-xs md:text-sm font-bold rounded-full w-fit hover:opacity-90 transition-opacity shadow-lg active:scale-95 inline-block';
