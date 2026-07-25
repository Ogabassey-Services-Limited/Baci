import type { SupabaseClient } from '@supabase/supabase-js';
import type { MerchantData } from './types';

type MerchantRow = Omit<MerchantData, 'feature_settings'> & {
  feature_settings?: unknown;
};

const PUBLIC_MERCHANT_SELECT = `
  id,
  business_name,
  business_type,
  email,
  phone,
  logo_url,
  brand_colors,
  country,
  payout_currency,
  pages,
  slug,
  published_config,
  favicon_svg_url,
  favicon_png_32_url,
  favicon_png_192_url,
  favicon_apple_touch_url,
  favicon_uploaded_at,
  social_media,
  support_email,
  support_phone,
  business_address,
  rider_phone_number,
  is_published,
  published_at,
  template_id,
  plan_tier,
  premium_features,
  hero_slides,
  mobile_hero_slides,
  feature_settings:merchant_feature_settings(*)
` as const;

/**
 * Normalize feature_settings from Supabase join.
 * Edge SQL may return an array instead of a single object.
 */
export function normalizeFeatureSettings(
  settings: unknown
): Record<string, unknown> | undefined {
  if (Array.isArray(settings)) return settings[0] as Record<string, unknown>;
  return settings as Record<string, unknown> | undefined;
}

function normalizeMerchantRow(merchant: MerchantRow | null | undefined) {
  if (!merchant) {
    return null;
  }

  return {
    ...merchant,
    feature_settings: normalizeFeatureSettings(merchant.feature_settings),
  } as MerchantData;
}

/**
 * Fetch merchant data by storefront slug.
 */
export async function fetchMerchantBySlug(
  supabase: SupabaseClient,
  slug: string
): Promise<MerchantData | null> {
  const { data, error } = await supabase
    .from('merchants')
    .select(PUBLIC_MERCHANT_SELECT)
    .eq('slug', slug)
    .maybeSingle();

  if (error && error.code !== 'PGRST116') {
    throw error;
  }

  return normalizeMerchantRow(data as MerchantRow | null);
}

/**
 * Fetch the primary custom domain for a merchant.
 */
export async function fetchPrimaryDomain(
  supabase: SupabaseClient,
  merchantId: string
): Promise<string | null> {
  const { data } = await supabase
    .from('domains')
    .select('domain')
    .eq('merchant_id', merchantId)
    .eq('is_primary', true)
    .eq('status', 'active')
    .maybeSingle();

  return data?.domain ?? null;
}
