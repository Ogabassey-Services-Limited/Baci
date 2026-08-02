export const PLATFORM_CONFIG = {
  name: 'Baci',
  legalName: 'Baci AI E-commerce',
  url: process.env.NEXT_PUBLIC_SITE_URL
    ? process.env.NEXT_PUBLIC_SITE_URL
    : process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3000',
  description:
    'Create your e-commerce store in seconds with AI. Launch a professional online store with no coding required.',
  version: '2.0.0',
  currency: 'NGN', // Platform base currency (Nigerian Naira)
  logo: '/baci-logo.svg',
  socialMedia: {
    twitter: 'https://twitter.com/usebaci',
    linkedin: 'https://linkedin.com/company/usebaci',
    instagram: 'https://instagram.com/usebaci',
  },
};

/** Apple Developer Team ID for Universal Links (AASA) */
export const APPLE_TEAM_ID = '6QLNK7TXM3' as const;

/**
 * Mobile app identifiers for ASO/SEO integration.
 * Used for Apple Smart App Banners, Schema.org MobileApplication,
 * deep linking, and .well-known verification files.
 *
 * `androidSha256Fingerprints` must match Play Console > App signing key.
 * `deepLinkPaths` define which URL paths the app handles.
 */
export const OGABASSEY_STOREFRONT_IOS_APP_ID = '6472735367' as const;

/**
 * OgaBassey's live App Store listing. Only OgaBassey-specific surfaces (e.g. the
 * storefront footer) may link here directly. The global
 * `MOBILE_APPS.storefront.appStoreUrl` fallback stays empty so non-OgaBassey
 * merchants never inherit this CTA (e.g. via import-notification emails).
 */
export const OGABASSEY_STOREFRONT_APP_STORE_URL = `https://apps.apple.com/app/id${OGABASSEY_STOREFRONT_IOS_APP_ID}`;

/**
 * OgaBassey's live Google Play listing. As with the App Store URL, only
 * OgaBassey-specific surfaces may link here directly; the global
 * `MOBILE_APPS.storefront.playStoreUrl` fallback stays empty so non-OgaBassey
 * merchants never inherit this CTA (e.g. via import-notification/receipt emails).
 */
export const OGABASSEY_STOREFRONT_PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=com.ogabassey.store' as const;

export const MOBILE_APPS = {
  admin: {
    name: 'Baci - The Ecommerce Builder',
    iosAppId: '6757810806',
    iosBundleId: 'com.ogabassey.baci',
    androidPackage: 'com.ogabassey.baci',
    androidSha256Fingerprints: [
      '10:F5:6F:4C:3E:00:7A:2C:B1:56:E5:52:70:34:47:4C:A8:68:7A:F8:A0:71:59:F7:34:A0:86:8A:8D:B1:53:29',
    ],
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.ogabassey.baci',
    appStoreUrl: 'https://apps.apple.com/app/id6757810806',
    deepLinkPaths: [
      '/dashboard/*',
      '/admin/*',
      '/store/*',
      '/orders/*',
      '/invite/*',
    ],
  },
  storefront: {
    name: 'Ogabassey - Easybuy Gadgets',
    // Keep empty globally; OgaBassey-specific layouts emit the Smart App Banner.
    iosAppId: '',
    iosBundleId: 'com.ogabassey.app',
    androidPackage: 'com.ogabassey.store',
    androidSha256Fingerprints: [
      '2A:30:FA:83:66:5D:C1:2B:77:BB:17:1B:48:EB:4F:12:03:33:DC:12:EC:A7:0A:6A:31:A9:D1:C7:38:6B:FC:96',
    ],
    // Keep empty globally so non-OgaBassey merchants don't inherit OgaBassey's
    // store CTAs (e.g. via import-notification/receipt emails); OgaBassey surfaces
    // use OGABASSEY_STOREFRONT_PLAY_STORE_URL / OGABASSEY_STOREFRONT_APP_STORE_URL.
    playStoreUrl: '',
    appStoreUrl: '',
    deepLinkPaths: [
      '/product/*',
      '/category/*',
      '/cart',
      '/receipts',
      '/receipts/claim/*',
      '/account',
      '/account/*',
      '/',
    ],
  },
} as const;
