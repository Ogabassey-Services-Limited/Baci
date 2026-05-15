export const OGABASSEY_HERO_DESKTOP_LCP_SRC =
  '/ogabassey/hero/iphone-17-pro-max-desktop.011z-1gfy2svu.avif';
export const OGABASSEY_HERO_MOBILE_LCP_SRC =
  '/ogabassey/hero/iphone-17-pro-max-mobile.02p9~ertxbycj.avif';
export const OGABASSEY_HERO_MOBILE_LCP_FALLBACK_SRC =
  '/ogabassey/hero/iphone-17-pro-max-mobile.0l7mj_a~pxwb9.jpg';

export const OGABASSEY_HOME_HERO_PRELOAD_LINK_HEADER = [
  `<${OGABASSEY_HERO_DESKTOP_LCP_SRC}>; rel=preload; as=image; type="image/avif"; fetchpriority=high; media="(min-width: 768px)"`,
  `<${OGABASSEY_HERO_MOBILE_LCP_SRC}>; rel=preload; as=image; type="image/avif"; fetchpriority=high; media="(max-width: 767px)"`,
].join(', ');
