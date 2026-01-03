import Constants from 'expo-constants';

/**
 * App Configuration
 * This is a dynamic merchant storefront app.
 * Identity is injected during build via app.config.js
 */

export const CONFIG = {
  MERCHANT_ID: Constants.expoConfig?.extra?.merchantId || '',
  MERCHANT_SLUG: Constants.expoConfig?.extra?.merchantSlug || 'baci-storefront',
  TEMPLATE_ID: Constants.expoConfig?.extra?.templateId || 'default',
  BUSINESS_TYPE: Constants.expoConfig?.extra?.businessType || 'electronics', // New: Business category
} as const;
