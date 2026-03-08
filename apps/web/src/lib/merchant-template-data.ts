import type { MerchantData } from '@/hooks/use-merchant';
import type { CachedMerchant } from '@/lib/cached-data';

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
    slug: merchant.slug,
    custom_domain: merchant.custom_domain,
    favicon_svg_url: merchant.favicon_svg_url,
    favicon_png_32_url: merchant.favicon_png_32_url,
    favicon_apple_touch_url: merchant.favicon_apple_touch_url,
    social_media: merchant.social_media,
    business_address: merchant.business_address,
    is_published: merchant.is_published,
    feature_settings: merchant.feature_settings,
    template_id: merchant.template_id,
    vat_registration_status: merchant.vat_registration_status,
    vat_rate: merchant.vat_rate,
    hero_slides: merchant.hero_slides,
    mobile_hero_slides: merchant.mobile_hero_slides,
  };
}
