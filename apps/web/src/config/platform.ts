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

/**
 * Mobile app identifiers for ASO/SEO integration.
 * Used for Apple Smart App Banners, Schema.org MobileApplication, and deep linking.
 */
export const MOBILE_APPS = {
  admin: {
    name: 'Baci - The Ecommerce Builder',
    iosAppId: '6757810806',
    iosBundleId: 'com.ogabassey.baci',
    androidPackage: 'com.ogabassey.baci',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.ogabassey.baci',
    appStoreUrl: 'https://apps.apple.com/app/id6757810806',
  },
  storefront: {
    name: 'Ogabassey - Easybuy Gadgets',
    // TODO: Add App Store ID once storefront iOS app is published
    iosAppId: '',
    iosBundleId: 'com.ogabassey.store',
    androidPackage: 'com.ogabassey.store',
    playStoreUrl:
      'https://play.google.com/store/apps/details?id=com.ogabassey.store',
    appStoreUrl: '',
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
