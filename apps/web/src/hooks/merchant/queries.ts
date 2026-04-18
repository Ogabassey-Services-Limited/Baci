import type { SupabaseClient } from '@supabase/supabase-js';
import { defaultStaffAccess, ownerStaffAccess } from './constants';
import type { MerchantData, StaffAccess, StaffRole } from './types';

type MerchantRow = Omit<MerchantData, 'feature_settings'> & {
  feature_settings?: unknown;
};

type StaffMemberRow = {
  merchants?: MerchantRow | MerchantRow[] | null;
  permissions?: Record<string, Record<string, boolean>> | null;
  role: StaffRole;
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
  pages,
  google_product_sheet_url,
  slug,
  custom_domain,
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

const DASHBOARD_MERCHANT_SELECT = `
  id,
  user_id,
  business_name,
  business_type,
  email,
  phone,
  logo_url,
  brand_colors,
  country,
  pages,
  google_product_sheet_url,
  slug,
  custom_domain,
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
  legal_entity_name,
  registered_address,
  tax_identification_number,
  trust_profile,
  plan_started_at,
  plan_expires_at,
  stripe_customer_id,
  stripe_subscription_id,
  offline_conversions_enabled,
  facebook_pixel_id,
  facebook_capi_token,
  google_analytics_id,
  ga4_api_secret,
  tiktok_pixel_id,
  tiktok_access_token,
  snapchat_pixel_id,
  snapchat_capi_token,
  twitter_pixel_id,
  virtual_terminal_code,
  vat_registration_status,
  vat_rate,
  nin,
  bvn,
  cac_rc_number,
  kyc_status,
  feature_settings:merchant_feature_settings(*)
` as const;

const STAFF_MEMBER_SELECT = `
  id,
  role,
  permissions,
  status,
  merchant_id,
  merchants(
    id,
    user_id,
    business_name,
    business_type,
    email,
    phone,
    logo_url,
    brand_colors,
    country,
    pages,
    google_product_sheet_url,
    slug,
    custom_domain,
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
    legal_entity_name,
    registered_address,
    tax_identification_number,
    trust_profile,
    plan_started_at,
    plan_expires_at,
    stripe_customer_id,
    stripe_subscription_id,
    offline_conversions_enabled,
    facebook_pixel_id,
    facebook_capi_token,
    google_analytics_id,
    ga4_api_secret,
    tiktok_pixel_id,
    tiktok_access_token,
    snapchat_pixel_id,
    snapchat_capi_token,
    twitter_pixel_id,
    virtual_terminal_code,
    vat_registration_status,
    vat_rate,
    nin,
    bvn,
    cac_rc_number,
    kyc_status,
    feature_settings:merchant_feature_settings(*)
  )
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
 * Fetch merchant and staff access for dashboard (authenticated user).
 * Runs owner + staff queries in parallel for performance.
 */
export async function fetchDashboardMerchant(
  supabase: SupabaseClient,
  userId: string
): Promise<{ merchant: MerchantData | null; staffAccess: StaffAccess }> {
  const [ownerResult, staffResult] = await Promise.all([
    supabase
      .from('merchants')
      .select(DASHBOARD_MERCHANT_SELECT)
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('staff_members')
      .select(STAFF_MEMBER_SELECT)
      .eq('user_id', userId)
      .eq('status', 'active')
      .maybeSingle(),
  ]);

  const ownerError = ownerResult.error;
  const staffError = staffResult.error;
  const ownedMerchant = normalizeMerchantRow(
    ownerResult.data as MerchantRow | null
  );
  const staffMember = staffResult.data as StaffMemberRow | null;

  // Check if user owns a VALID merchant (not an incomplete/customer merchant)
  const isValidMerchant =
    ownedMerchant &&
    (ownedMerchant.business_name !== null || ownedMerchant.slug !== null);

  // Owner path
  if (isValidMerchant && !ownerError) {
    return {
      merchant: ownedMerchant,
      staffAccess: { ...ownerStaffAccess },
    };
  }

  const isOwnerMissing = ownerError?.code === 'PGRST116';

  // Staff path — user is not a valid merchant owner, check staff membership
  if (!isValidMerchant || (!ownedMerchant && !ownerError) || isOwnerMissing) {
    if (staffMember && !staffError) {
      const merchantInfo = normalizeMerchantRow(
        Array.isArray(staffMember.merchants)
          ? (staffMember.merchants[0] ?? null)
          : (staffMember.merchants ?? null)
      );

      if (merchantInfo) {
        // Get effective permissions (role defaults + custom overrides)
        const { data: rolePerms } = await supabase
          .from('role_permissions')
          .select('permissions')
          .eq('role', staffMember.role)
          .single();

        const defaultPerms = (rolePerms?.permissions || {}) as Record<
          string,
          Record<string, boolean>
        >;
        const customPerms = (staffMember.permissions || {}) as Record<
          string,
          Record<string, boolean>
        >;

        const mergedPermissions: Record<string, Record<string, boolean>> = {
          ...defaultPerms,
        };
        for (const [resource, actions] of Object.entries(customPerms)) {
          mergedPermissions[resource] = {
            ...mergedPermissions[resource],
            ...actions,
          };
        }

        return {
          merchant: merchantInfo,
          staffAccess: {
            isStaff: true,
            isOwner: false,
            role: staffMember.role as StaffRole,
            permissions: mergedPermissions,
          },
        };
      }
    }
  } else if (ownerError) {
    throw ownerError;
  }

  return { merchant: null, staffAccess: { ...defaultStaffAccess } };
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
