import iphoneHeroDesktopAsset from './assets/iphone-17-pro-max-desktop.avif';
import iphoneHeroMobileAsset from './assets/iphone-17-pro-max-mobile.avif';
import iphoneHeroMobileFallbackAsset from './assets/iphone-17-pro-max-mobile.jpg';

export type HeroSlideType = 'image' | 'video' | 'ad';

export interface HeroSlideData {
  id: number;
  type: HeroSlideType;
  title?: string;
  subtitle?: string;
  bgClass?: string;
  src?: string;
  poster?: string;
  textColor?: string;
  imageFit?: 'contain' | 'cover';
  captions?: string;
}

export interface HeroDesktopSlideData {
  id: number;
  title: string;
  subtitle: string;
  headline: string;
  headlineSuffix: string;
  image: string;
  theme: 'light' | 'dark';
}

type ImportedImageAsset = { src: string } | string;

const getImportedImageSrc = (asset: ImportedImageAsset) =>
  typeof asset === 'string' ? asset : asset.src;

export const HERO_DESKTOP_LCP_SRC = getImportedImageSrc(
  iphoneHeroDesktopAsset
);
export const HERO_MOBILE_LCP_SRC = getImportedImageSrc(iphoneHeroMobileAsset);
export const HERO_MOBILE_LCP_FALLBACK_SRC = getImportedImageSrc(
  iphoneHeroMobileFallbackAsset
);
// Slug shapes the storefront [slug] route observes for OgaBassey:
//   - 'ogabassey'      — direct path /{ogabassey} on the platform domain or *.usebaci.com subdomain
//   - 'ogabassey.com'  — custom-domain rewrite via proxy.ts (host → /${domain}${pathname});
//                        proxy normalizes 'www.ogabassey.com' down to this form.
export const OGABASSEY_HERO_PRELOAD_IDENTIFIERS = new Set([
  'ogabassey',
  'ogabassey.com',
]);

export const NEW_ARRIVALS_PROMO_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/macbook-pro.avif';
export const FLASH_SALE_PROMO_IMAGE =
  'https://cdn.ogabassey.com/core-assets/products/ps5-digital-slim-console-1tb.avif';

export const MOBILE_SLIDES: HeroSlideData[] = [
  {
    id: 1,
    type: 'image',
    title: 'iPhone 17 Pro Max',
    subtitle: 'Beyond IMAGINATION with the new nebula finish.',
    bgClass: 'bg-[#F5F5F7]',
    src: HERO_MOBILE_LCP_SRC,
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

export const DESKTOP_IPHONE_SLIDES: HeroDesktopSlideData[] = [
  {
    id: 1,
    title: 'iPhone 17',
    subtitle: 'Pro Max',
    headline: 'Beyond',
    headlineSuffix: 'IMAGINATION',
    image: HERO_DESKTOP_LCP_SRC,
    theme: 'light',
  },
  {
    id: 2,
    title: 'Titanium',
    subtitle: 'Design',
    headline: 'Forged in',
    headlineSuffix: 'TITANIUM',
    image: HERO_DESKTOP_LCP_SRC,
    theme: 'light',
  },
  {
    id: 3,
    title: 'A17 Pro',
    subtitle: 'Chip',
    headline: 'Monster',
    headlineSuffix: 'PERFORMANCE',
    image: HERO_DESKTOP_LCP_SRC,
    theme: 'light',
  },
];
