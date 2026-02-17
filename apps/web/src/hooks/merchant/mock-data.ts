import type { MerchantData } from './types';

const gadgetDefaultMerchant: MerchantData = {
  id: 'demo-ogabassey',
  user_id: 'demo-user',
  business_name: 'Ogabassey',
  business_type: 'FASHION',
  logo_url:
    'https://ogabassey.com/wp-content/uploads/2023/06/Ogabassey-Logo-1.png',
  brand_colors: {
    primary: '#EF4444',
    background: '#FFFFFF',
    accent: '#000000',
  },
  country: 'NG',
  slug: 'gadget-default-template',
  published_config: null,
  plan_tier: 'pro',
};

const ogabasseyMerchant: MerchantData = {
  id: 'demo-ogabassey',
  user_id: 'demo-user',
  business_name: 'Ogabassey',
  business_type: 'GADGETS',
  logo_url:
    'https://ogabassey.com/wp-content/uploads/2023/06/Ogabassey-Logo-1.png',
  brand_colors: {
    primary: '#DC2626',
    background: '#0F172A',
    accent: '#22D3EE',
  },
  country: 'NG',
  slug: 'ogabassey',
  published_config: null,
  plan_tier: 'pro',
  template_id: 'ogabassey',
  feature_settings: {
    shipping_insurance_enabled: true,
  },
};

const premiumDefaultMerchant: MerchantData = {
  id: 'demo-premium',
  user_id: 'demo-user',
  business_name: 'Premium Store',
  business_type: 'FASHION',
  logo_url: undefined,
  brand_colors: {
    primary: '#000000',
    background: '#FAFAFA',
    accent: '#D4AF37',
  },
  country: 'NG',
  slug: 'premium-default',
  published_config: null,
  plan_tier: 'pro',
};

const newTemplateDemoMerchant: MerchantData = {
  id: 'demo-new-template',
  user_id: 'demo-user',
  business_name: 'Modern Gadgets',
  business_type: 'GADGETS',
  logo_url: undefined,
  brand_colors: {
    primary: '#DC2626',
    background: '#FFFFFF',
    accent: '#111827',
  },
  country: 'NG',
  slug: 'new-template-demo',
  published_config: null,
  plan_tier: 'pro',
};

const gadgetUniverseDemoMerchant: MerchantData = {
  id: 'demo-gadget-universe',
  user_id: 'demo-user',
  business_name: 'Gadget Universe',
  business_type: 'GADGETS',
  logo_url: undefined,
  brand_colors: {
    primary: '#DC2626',
    background: '#FFFFFF',
    accent: '#111827',
  },
  country: 'NG',
  slug: 'gadget-universe-demo',
  published_config: null,
  plan_tier: 'pro',
};

/**
 * Map of demo slug -> mock MerchantData.
 * Used for template preview routes with known demo slugs.
 */
export const DEMO_MERCHANTS: Record<string, MerchantData> = {
  'gadget-default-template': gadgetDefaultMerchant,
  ogabassey: ogabasseyMerchant,
  'premium-default': premiumDefaultMerchant,
  'new-template-demo': newTemplateDemoMerchant,
  'gadget-universe-demo': gadgetUniverseDemoMerchant,
};

/**
 * Get mock merchant data for a demo slug.
 * Returns null if the slug is not a registered demo.
 */
export function getDemoMerchant(slug: string): MerchantData | null {
  return DEMO_MERCHANTS[slug] ?? null;
}
