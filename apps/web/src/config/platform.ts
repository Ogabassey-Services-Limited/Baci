import type { SoftwareApplicationData } from '@/lib/seo-utils';

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
    deepLinkPaths: ['/dashboard/*', '/admin/*', '/store/*', '/orders/*'],
  },
  storefront: {
    name: 'Ogabassey - Easybuy Gadgets',
    // TODO: Add App Store ID once storefront iOS app is published
    iosAppId: '',
    iosBundleId: 'com.ogabassey.store',
    androidPackage: 'com.ogabassey.store',
    androidSha256Fingerprints: [
      '7F:EA:BB:6C:3C:16:62:84:98:B7:AA:5C:6E:33:C0:1B:F8:40:09:B5:9B:DD:F4:5A:02:3B:AB:DD:3B:26:8F:A8',
    ],
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.ogabassey.store',
    appStoreUrl: '',
    deepLinkPaths: ['/product/*', '/blog/*', '/category/*', '/cart', '/'],
  },
} as const;

export const PLATFORM_PRICING: SoftwareApplicationData = {
  name: PLATFORM_CONFIG.name,
  applicationCategory: 'BusinessApplication',
  operatingSystem: 'Web',
  description: PLATFORM_CONFIG.description,
  url: PLATFORM_CONFIG.url,
  softwareVersion: PLATFORM_CONFIG.version,
  image: `${PLATFORM_CONFIG.url}/opengraph-image`,
  featureList: [
    'AI Store Builder',
    'Inventory Management',
    'Payment Processing',
    'SEO Optimization',
    'Analytics Dashboard',
  ],
  offers: [
    {
      name: 'Free Tier',
      description: 'Perfect for starting out',
      price: 0,
      currency: PLATFORM_CONFIG.currency,
      billingDuration: 'P1M',
    },
    {
      name: 'Pro Tier',
      description: 'For growing businesses',
      price: 5000,
      currency: PLATFORM_CONFIG.currency,
      billingDuration: 'P1M',
    },
    {
      name: 'Premium Tier',
      description: 'For scaling enterprises',
      price: 15000,
      currency: PLATFORM_CONFIG.currency,
      billingDuration: 'P1M',
    },
  ],
};
