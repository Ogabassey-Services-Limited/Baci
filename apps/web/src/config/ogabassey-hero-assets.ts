import heroDesktopAvif from '@/components/storefront/ogabassey/components/assets/iphone-17-pro-max-desktop.011z-1gfy2svu.avif';
import heroDesktopJpeg from '@/components/storefront/ogabassey/components/assets/iphone-17-pro-max-desktop.011z-1gfy2svu.jpg';
import heroMobileJpeg from '@/components/storefront/ogabassey/components/assets/iphone-17-pro-max-mobile.0l7mj_a~pxwb9.jpg';
import heroMobileAvif from '@/components/storefront/ogabassey/components/assets/iphone-17-pro-max-mobile.02p9~ertxbycj.avif';

type ImportedImageAsset = { src: string } | string;

const getImportedImageSrc = (asset: ImportedImageAsset) =>
  typeof asset === 'string' ? asset : asset.src;

export const OGABASSEY_HERO_DESKTOP_LCP_SRC =
  getImportedImageSrc(heroDesktopAvif);
export const OGABASSEY_HERO_DESKTOP_LCP_FALLBACK_SRC =
  getImportedImageSrc(heroDesktopJpeg);
export const OGABASSEY_HERO_MOBILE_LCP_SRC =
  getImportedImageSrc(heroMobileAvif);
export const OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC =
  getImportedImageSrc(heroMobileJpeg);
