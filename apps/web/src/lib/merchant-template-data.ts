import type { MerchantData } from '@/hooks/use-merchant';
import type { CachedMerchant } from '@/lib/cached-data';

function normalizePlanTier(
  planTier: CachedMerchant['plan_tier']
): MerchantData['plan_tier'] {
  switch (planTier) {
    case 'free':
    case 'starter':
    case 'pro':
    case 'business':
    case 'enterprise':
      return planTier;
    default:
      return undefined;
  }
}

function normalizePremiumFeatures(
  premiumFeatures: CachedMerchant['premium_features']
): MerchantData['premium_features'] {
  return Array.isArray(premiumFeatures) &&
    premiumFeatures.every((feature) => typeof feature === 'string')
    ? premiumFeatures
    : undefined;
}

export function toTemplateMerchantData(merchant: CachedMerchant): MerchantData {
  return {
    id: merchant.id,
    // Public storefront rendering does not expose the owner user id.
    user_id: '',
    business_name: merchant.business_name,
    business_type: merchant.business_type,
    email: merchant.email,
    phone: merchant.phone,
    logo_url: merchant.logo_url,
    brand_colors: merchant.brand_colors,
    country: merchant.country,
    pages: merchant.pages,
    paystack_subaccount_code: merchant.paystack_subaccount_code,
    slug: merchant.slug,
    custom_domain: merchant.custom_domain,
    favicon_svg_url: merchant.favicon_svg_url,
    favicon_png_32_url: merchant.favicon_png_32_url,
    favicon_apple_touch_url: merchant.favicon_apple_touch_url,
    social_media: merchant.social_media,
    support_email: merchant.support_email ?? undefined,
    support_phone: merchant.support_phone ?? undefined,
    business_address: merchant.business_address,
    legal_entity_name: merchant.legal_entity_name,
    registered_address: merchant.registered_address,
    tax_identification_number: merchant.tax_identification_number,
    trust_profile: merchant.trust_profile,
    is_published: merchant.is_published,
    feature_settings: merchant.feature_settings,
    template_id: merchant.template_id,
    plan_tier: normalizePlanTier(merchant.plan_tier),
    premium_features: normalizePremiumFeatures(merchant.premium_features),
    published_config: merchant.published_config,
    vat_registration_status: merchant.vat_registration_status,
    vat_rate: merchant.vat_rate,
    hero_slides: merchant.hero_slides,
    mobile_hero_slides: merchant.mobile_hero_slides,
  };
}
