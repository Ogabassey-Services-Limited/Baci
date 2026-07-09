import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import {
  revalidateFeatures,
  revalidateMerchant,
  revalidateRepairsCatalog,
} from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import {
  getMerchantFeatureAccess,
  merchantFeatureUpgradeResponse,
} from '@/lib/merchant-feature-gates';
import { merchantFeatureSettingsDefaults } from '@/lib/merchant-feature-settings-defaults';
import {
  preserveZohoCampaignSecretCustomSettings,
  redactMerchantFeatureSettingsResponse,
} from '@/lib/merchant-feature-settings-redaction';
import { merchantFeatureSettingsPatchSchema } from '@/schemas/merchant-features';

/**
 * Merchant Feature Settings API
 *
 * GET - Get merchant's feature settings
 * PATCH - Update specific feature settings
 * PUT - Replace all feature settings
 */

export interface MerchantFeatureSettings {
  id: string | null;
  merchant_id: string;

  // Feature toggles
  loyalty_enabled: boolean;
  reviews_enabled: boolean;
  wishlist_enabled: boolean;
  order_tracking_enabled: boolean;
  discount_codes_enabled: boolean;
  guest_checkout_enabled: boolean;
  agentic_checkout_enabled: boolean;
  repairs_catalog_enabled: boolean;

  // Payment gateways
  paystack_enabled: boolean;
  korapay_enabled: boolean;
  pay_on_delivery_enabled: boolean;
  credit_direct_enabled: boolean;
  credit_direct_public_key: string | null;
  credit_direct_min_amount: number;
  credit_direct_max_amount: number;
  credpal_enabled: boolean;
  klump_enabled: boolean;
  klump_min_amount: number;
  klump_max_amount: number;
  preferred_local_gateway: 'paystack' | 'korapay';
  preferred_international_gateway: 'paystack' | 'korapay';

  // Shipping
  shipping_providers: string[];
  free_shipping_threshold: number | null;
  shipping_markup_percentage: number;

  // Checkout
  checkout_collect_phone: boolean;
  checkout_require_account: boolean;
  checkout_show_order_notes: boolean;

  // Store pages
  about_page_enabled: boolean;
  contact_page_enabled: boolean;
  faq_page_enabled: boolean;
  privacy_page_enabled: boolean;
  terms_page_enabled: boolean;
  rewards_page_enabled: boolean;

  // Social proof
  show_recent_purchases: boolean;
  show_stock_levels: boolean;
  low_stock_threshold: number;

  // Analytics
  google_analytics_id: string | null;
  ga4_api_secret: string | null;
  facebook_pixel_id: string | null;
  facebook_capi_token: string | null;
  tiktok_pixel_id: string | null;
  tiktok_access_token: string | null;
  snapchat_pixel_id: string | null;
  snapchat_capi_token: string | null;
  twitter_pixel_id: string | null;

  // SEO
  auto_generate_schema: boolean;
  custom_robots_txt: string | null;

  // Notifications
  email_notifications_enabled: boolean;
  sms_notifications_enabled: boolean;

  // Blog settings
  blog_enabled: boolean;
  auto_blog_enabled: boolean;
  google_reviews_enabled: boolean;
  google_place_id: string | null;

  // VTU (Value Top-Up) Settings
  vtu_enabled: boolean;
  vtu_airtime_enabled: boolean;
  vtu_data_enabled: boolean;
  vtu_electricity_enabled: boolean;
  vtu_tv_enabled: boolean;
  vtu_betting_enabled: boolean;
  vtu_checkout_addon_enabled: boolean;
  vtu_checkout_addon_amounts: number[];
  vtu_loyalty_reward_enabled: boolean;
  vtu_merchant_commission_rate: number;
  vtu_customer_cashback_enabled: boolean;
  vtu_customer_cashback_rate: number;

  // Custom
  custom_settings: Record<string, unknown>;

  created_at: string | null;
  updated_at: string | null;
}

const PRIVATE_NO_STORE_HEADERS = {
  'Cache-Control': 'private, no-store, no-cache, max-age=0, must-revalidate',
};

function jsonNoStore<T>(body: T, init?: ResponseInit) {
  const headers = new Headers(init?.headers);
  headers.set('Cache-Control', PRIVATE_NO_STORE_HEADERS['Cache-Control']);
  return NextResponse.json(body, {
    ...init,
    headers,
  });
}

function withNoStore(response: NextResponse) {
  response.headers.set(
    'Cache-Control',
    PRIVATE_NO_STORE_HEADERS['Cache-Control']
  );
  return response;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    error.code === '23505'
  );
}

// Columns selected when reading merchant feature settings.
// Typed against MerchantFeatureSettings so any drift between the SELECT list
// and the interface is caught at compile time.
const MERCHANT_FEATURE_SELECT_FIELDS: readonly (keyof MerchantFeatureSettings)[] =
  [
    'id',
    'merchant_id',
    'loyalty_enabled',
    'reviews_enabled',
    'wishlist_enabled',
    'order_tracking_enabled',
    'discount_codes_enabled',
    'guest_checkout_enabled',
    'agentic_checkout_enabled',
    'repairs_catalog_enabled',
    'paystack_enabled',
    'korapay_enabled',
    'pay_on_delivery_enabled',
    'credit_direct_enabled',
    'credit_direct_public_key',
    'credit_direct_min_amount',
    'credit_direct_max_amount',
    'credpal_enabled',
    'klump_enabled',
    'klump_min_amount',
    'klump_max_amount',
    'preferred_local_gateway',
    'preferred_international_gateway',
    'shipping_providers',
    'free_shipping_threshold',
    'shipping_markup_percentage',
    'checkout_collect_phone',
    'checkout_require_account',
    'checkout_show_order_notes',
    'about_page_enabled',
    'contact_page_enabled',
    'faq_page_enabled',
    'privacy_page_enabled',
    'terms_page_enabled',
    'rewards_page_enabled',
    'show_recent_purchases',
    'show_stock_levels',
    'low_stock_threshold',
    'google_analytics_id',
    'ga4_api_secret',
    'facebook_pixel_id',
    'facebook_capi_token',
    'tiktok_pixel_id',
    'tiktok_access_token',
    'snapchat_pixel_id',
    'snapchat_capi_token',
    'twitter_pixel_id',
    'auto_generate_schema',
    'custom_robots_txt',
    'email_notifications_enabled',
    'sms_notifications_enabled',
    'blog_enabled',
    'auto_blog_enabled',
    'google_reviews_enabled',
    'google_place_id',
    'vtu_enabled',
    'vtu_airtime_enabled',
    'vtu_data_enabled',
    'vtu_electricity_enabled',
    'vtu_tv_enabled',
    'vtu_betting_enabled',
    'vtu_checkout_addon_enabled',
    'vtu_checkout_addon_amounts',
    'vtu_loyalty_reward_enabled',
    'vtu_merchant_commission_rate',
    'vtu_customer_cashback_enabled',
    'vtu_customer_cashback_rate',
    'custom_settings',
    'created_at',
    'updated_at',
  ];

// Compile-time exhaustiveness check: ensure every key in MerchantFeatureSettings
// is included in MERCHANT_FEATURE_SELECT_FIELDS. If keys are missing, the
// computed type collapses to a tuple literal that is not assignable to `true`,
// causing a TypeScript error here (revealing the missing keys in the diagnostic).
type _MerchantFeatureSelectFieldsExhaustive =
  Exclude<
    keyof MerchantFeatureSettings,
    (typeof MERCHANT_FEATURE_SELECT_FIELDS)[number]
  > extends never
    ? true
    : [
        'Missing keys in MERCHANT_FEATURE_SELECT_FIELDS:',
        Exclude<
          keyof MerchantFeatureSettings,
          (typeof MERCHANT_FEATURE_SELECT_FIELDS)[number]
        >,
      ];
const _merchantFeatureSelectCompletenessCheck: _MerchantFeatureSelectFieldsExhaustive = true;
void _merchantFeatureSelectCompletenessCheck;

const GROWTH_INTEGRATION_SETTINGS_FIELDS = new Set<
  keyof MerchantFeatureSettings
>([
  'google_analytics_id',
  'ga4_api_secret',
  'facebook_pixel_id',
  'facebook_capi_token',
  'tiktok_pixel_id',
  'tiktok_access_token',
  'snapchat_pixel_id',
  'snapchat_capi_token',
  'twitter_pixel_id',
]);

function hasNonEmptyGrowthIntegrationSetting(updates: Record<string, unknown>) {
  return [...GROWTH_INTEGRATION_SETTINGS_FIELDS].some((field) => {
    if (!(field in updates)) {
      return false;
    }

    const value = updates[field];
    return typeof value === 'string'
      ? value.trim().length > 0
      : value !== null && value !== undefined;
  });
}

function revalidateMerchantFeatureCaches(
  merchantId: string,
  updates: Record<string, unknown>
) {
  revalidateFeatures(merchantId);
  revalidateMerchant(merchantId);

  if ('repairs_catalog_enabled' in updates) {
    revalidateRepairsCatalog(merchantId);
  }
}

type MerchantFeatureDefaultField = Exclude<
  keyof MerchantFeatureSettings,
  'id' | 'merchant_id' | 'created_at' | 'updated_at'
>;

// Default settings for new merchants. The shared defaults object intentionally
// has no persisted metadata columns, so this route adds null response metadata
// on the read-only no-row path below.
const DEFAULT_SETTINGS =
  merchantFeatureSettingsDefaults.buildFields() as Record<
    MerchantFeatureDefaultField,
    unknown
  >;

function getDefaultFeatureSetting(field: MerchantFeatureDefaultField) {
  const value = DEFAULT_SETTINGS[field];
  if (value === undefined) {
    throw new Error(`Missing default merchant feature setting: ${field}`);
  }

  return value;
}

function buildReadOnlyDefaultSettings(
  merchantId: string
): MerchantFeatureSettings {
  const settings: Record<string, unknown> = {};

  for (const field of MERCHANT_FEATURE_SELECT_FIELDS) {
    if (field === 'id' || field === 'created_at' || field === 'updated_at') {
      settings[field] = null;
      continue;
    }

    if (field === 'merchant_id') {
      settings[field] = merchantId;
      continue;
    }

    settings[field] = getDefaultFeatureSetting(field);
  }

  return settings as unknown as MerchantFeatureSettings;
}

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return jsonNoStore(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return jsonNoStore({ error: 'Merchant not found' }, { status: 404 });
    }

    if (
      !hasPermission(access, 'settings', 'view') &&
      !hasPermission(access, 'marketing', 'view') &&
      !hasPermission(access, 'dashboard', 'view')
    ) {
      return jsonNoStore({ error: 'Permission denied' }, { status: 403 });
    }

    // GET must remain read-only. If no persisted settings row exists, return
    // response-only defaults; PATCH/PUT own persistence when the merchant edits.
    const { data: settings, error } = await auth.supabase
      .from('merchant_feature_settings')
      .select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))
      .eq('merchant_id', access.merchantId)
      .maybeSingle();

    if (!error && !settings) {
      return jsonNoStore(
        redactMerchantFeatureSettingsResponse(
          buildReadOnlyDefaultSettings(access.merchantId)
        )
      );
    }

    if (error) {
      console.error('Error fetching feature settings:', error);
      return jsonNoStore(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return jsonNoStore(redactMerchantFeatureSettingsResponse(settings));
  } catch (error) {
    console.error('Feature settings GET error:', error);
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        (response ? withNoStore(response) : null) ??
        jsonNoStore({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return jsonNoStore(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return jsonNoStore({ error: 'Merchant not found' }, { status: 404 });
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return jsonNoStore({ error: 'Permission denied' }, { status: 403 });
    }

    let updates: Record<string, unknown>;
    try {
      updates = await request.json();
    } catch {
      return jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedUpdates = merchantFeatureSettingsPatchSchema.safeParse(updates);
    if (!parsedUpdates.success) {
      return jsonNoStore(
        {
          error: 'Invalid input',
          details: parsedUpdates.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const sanitizedUpdates = parsedUpdates.data;

    // Sync rewards_page_enabled with loyalty_enabled
    if ('loyalty_enabled' in sanitizedUpdates) {
      sanitizedUpdates.rewards_page_enabled = sanitizedUpdates.loyalty_enabled;
    }

    if (hasNonEmptyGrowthIntegrationSetting(sanitizedUpdates)) {
      const featureAccess = await getMerchantFeatureAccess(
        auth.supabase,
        access.merchantId,
        'growth_integrations'
      );
      if (featureAccess.error) {
        console.error(
          'Error checking growth integration access:',
          featureAccess.error
        );
        return jsonNoStore(
          { error: 'Failed to verify merchant plan' },
          { status: 500 }
        );
      }
      if (!featureAccess.allowed) {
        return withNoStore(
          merchantFeatureUpgradeResponse('growth_integrations')
        );
      }
    }

    const { data: existingSettings, error: existingSettingsError } =
      await auth.supabase
        .from('merchant_feature_settings')
        .select('custom_settings')
        .eq('merchant_id', access.merchantId)
        .maybeSingle();

    if (existingSettingsError) {
      console.error(
        'Error checking existing feature settings:',
        existingSettingsError
      );
      return jsonNoStore(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    if ('custom_settings' in sanitizedUpdates) {
      sanitizedUpdates.custom_settings =
        preserveZohoCampaignSecretCustomSettings(
          sanitizedUpdates.custom_settings,
          existingSettings?.custom_settings
        );
    }

    const settingsPayload = {
      ...sanitizedUpdates,
      updated_at: new Date().toISOString(),
    };

    const writeResult = existingSettings
      ? await auth.supabase
          .from('merchant_feature_settings')
          .update(settingsPayload)
          .eq('merchant_id', access.merchantId)
          .select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))
          .single()
      : await auth.supabase
          .from('merchant_feature_settings')
          .insert({
            ...DEFAULT_SETTINGS,
            merchant_id: access.merchantId,
            ...settingsPayload,
          })
          .select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))
          .single();

    const { data: settings, error } =
      !existingSettings && isUniqueViolation(writeResult.error)
        ? await auth.supabase
            .from('merchant_feature_settings')
            .update(settingsPayload)
            .eq('merchant_id', access.merchantId)
            .select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))
            .single()
        : writeResult;

    if (error) {
      console.error('Error updating feature settings:', error);
      return jsonNoStore(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    revalidateMerchantFeatureCaches(access.merchantId, sanitizedUpdates);

    return jsonNoStore(redactMerchantFeatureSettingsResponse(settings));
  } catch (error) {
    console.error('Feature settings PATCH error:', error);
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        (response ? withNoStore(response) : null) ??
        jsonNoStore({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return jsonNoStore(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return jsonNoStore({ error: 'Merchant not found' }, { status: 404 });
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return jsonNoStore({ error: 'Permission denied' }, { status: 403 });
    }

    let newSettings: Record<string, unknown>;
    try {
      newSettings = await request.json();
    } catch {
      return jsonNoStore({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedSettings =
      merchantFeatureSettingsPatchSchema.safeParse(newSettings);
    if (!parsedSettings.success) {
      return jsonNoStore(
        {
          error: 'Invalid input',
          details: parsedSettings.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const sanitizedSettings = parsedSettings.data;

    if (hasNonEmptyGrowthIntegrationSetting(sanitizedSettings)) {
      const featureAccess = await getMerchantFeatureAccess(
        auth.supabase,
        access.merchantId,
        'growth_integrations'
      );
      if (featureAccess.error) {
        console.error(
          'Error checking growth integration access:',
          featureAccess.error
        );
        return jsonNoStore(
          { error: 'Failed to verify merchant plan' },
          { status: 500 }
        );
      }
      if (!featureAccess.allowed) {
        return withNoStore(
          merchantFeatureUpgradeResponse('growth_integrations')
        );
      }
    }

    const { data: existingSettings, error: existingSettingsError } =
      await auth.supabase
        .from('merchant_feature_settings')
        .select('custom_settings')
        .eq('merchant_id', access.merchantId)
        .maybeSingle();

    if (existingSettingsError) {
      console.error(
        'Error checking existing feature settings:',
        existingSettingsError
      );
      return jsonNoStore({ error: 'Failed to save settings' }, { status: 500 });
    }

    sanitizedSettings.custom_settings =
      preserveZohoCampaignSecretCustomSettings(
        sanitizedSettings.custom_settings,
        existingSettings?.custom_settings
      );

    // Merge with defaults for any missing fields
    const completeSettings = {
      ...DEFAULT_SETTINGS,
      ...sanitizedSettings,
      merchant_id: access.merchantId,
      updated_at: new Date().toISOString(),
    };

    // Sync rewards_page_enabled with loyalty_enabled
    completeSettings.rewards_page_enabled = completeSettings.loyalty_enabled;

    const { data: settings, error } = await auth.supabase
      .from('merchant_feature_settings')
      .upsert(completeSettings, {
        onConflict: 'merchant_id',
      })
      .select(MERCHANT_FEATURE_SELECT_FIELDS.join(', '))
      .single();

    if (error) {
      console.error('Error replacing feature settings:', error);
      return jsonNoStore({ error: 'Failed to save settings' }, { status: 500 });
    }

    revalidateMerchantFeatureCaches(access.merchantId, sanitizedSettings);

    return jsonNoStore(redactMerchantFeatureSettingsResponse(settings));
  } catch (error) {
    console.error('Feature settings PUT error:', error);
    return jsonNoStore({ error: 'Internal server error' }, { status: 500 });
  }
}
