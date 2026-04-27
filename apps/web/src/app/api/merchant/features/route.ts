import { type NextRequest, NextResponse } from 'next/server';
import {
  authenticateApiRequest,
  getUserAccess,
  hasPermission,
} from '@/lib/api-auth';
import { revalidateFeatures } from '@/lib/cache-revalidation';
import { checkCsrfProtection } from '@/lib/csrf';
import { merchantFeatureSettingsSchema } from '@/schemas/merchant-features';

/**
 * Merchant Feature Settings API
 *
 * GET - Get merchant's feature settings
 * PATCH - Update specific feature settings
 * PUT - Replace all feature settings
 */

export interface MerchantFeatureSettings {
  id: string;
  merchant_id: string;

  // Feature toggles
  loyalty_enabled: boolean;
  reviews_enabled: boolean;
  wishlist_enabled: boolean;
  order_tracking_enabled: boolean;
  discount_codes_enabled: boolean;
  guest_checkout_enabled: boolean;

  // Payment gateways
  paystack_enabled: boolean;
  korapay_enabled: boolean;
  pay_on_delivery_enabled: boolean;
  credit_direct_enabled: boolean;
  credit_direct_public_key: string | null;
  credit_direct_min_amount: number;
  credit_direct_max_amount: number;
  credpal_enabled: boolean;
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
  offline_conversions_enabled: boolean;

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

  created_at: string;
  updated_at: string;
}

// Columns selected when reading merchant feature settings.
// Kept here so the SELECT clause can be referenced by name in queries.
const MERCHANT_FEATURE_SELECT_FIELDS = [
  'id',
  'merchant_id',
  'loyalty_enabled',
  'reviews_enabled',
  'wishlist_enabled',
  'order_tracking_enabled',
  'discount_codes_enabled',
  'guest_checkout_enabled',
  'paystack_enabled',
  'korapay_enabled',
  'pay_on_delivery_enabled',
  'credit_direct_enabled',
  'credit_direct_public_key',
  'credit_direct_min_amount',
  'credit_direct_max_amount',
  'credpal_enabled',
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
  'offline_conversions_enabled',
  'created_at',
  'updated_at',
].join(', ');

// Default settings for new merchants
const DEFAULT_SETTINGS: Partial<MerchantFeatureSettings> = {
  loyalty_enabled: false,
  reviews_enabled: true,
  wishlist_enabled: true,
  order_tracking_enabled: true,
  discount_codes_enabled: true,
  guest_checkout_enabled: true,
  // Payment gateways - both enabled by default
  paystack_enabled: true,
  korapay_enabled: true,
  pay_on_delivery_enabled: false,
  credit_direct_enabled: false,
  credit_direct_public_key: null,
  credit_direct_min_amount: 10000,
  credit_direct_max_amount: 500000,
  credpal_enabled: false,
  preferred_local_gateway: 'paystack',
  preferred_international_gateway: 'korapay',
  // Shipping
  shipping_providers: ['gigl', 'topship'],
  free_shipping_threshold: null,
  shipping_markup_percentage: 0,
  checkout_collect_phone: true,
  checkout_require_account: false,
  checkout_show_order_notes: true,
  about_page_enabled: true,
  contact_page_enabled: true,
  faq_page_enabled: true,
  privacy_page_enabled: true,
  terms_page_enabled: true,
  rewards_page_enabled: false,
  show_recent_purchases: false,
  show_stock_levels: true,
  low_stock_threshold: 10,
  google_analytics_id: null,
  ga4_api_secret: null,
  facebook_pixel_id: null,
  facebook_capi_token: null,
  tiktok_pixel_id: null,
  tiktok_access_token: null,
  snapchat_pixel_id: null,
  snapchat_capi_token: null,
  twitter_pixel_id: null,
  auto_generate_schema: true,
  custom_robots_txt: null,
  email_notifications_enabled: true,
  sms_notifications_enabled: false,
  offline_conversions_enabled: false,
  // Blog defaults
  blog_enabled: false,
  auto_blog_enabled: false,
  google_reviews_enabled: false,
  google_place_id: null,
  // VTU defaults
  vtu_enabled: false,
  vtu_airtime_enabled: true,
  vtu_data_enabled: true,
  vtu_electricity_enabled: true,
  vtu_tv_enabled: true,
  vtu_betting_enabled: true,
  vtu_checkout_addon_enabled: false,
  vtu_checkout_addon_amounts: [100, 200, 500, 1000],
  vtu_loyalty_reward_enabled: false,
  vtu_merchant_commission_rate: 50,
  vtu_customer_cashback_enabled: false,
  vtu_customer_cashback_rate: 50,
  custom_settings: {},
};

export async function GET(request: NextRequest) {
  try {
    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (
      !hasPermission(access, 'settings', 'view') &&
      !hasPermission(access, 'marketing', 'view') &&
      !hasPermission(access, 'dashboard', 'view')
    ) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    // Get or create settings
    let { data: settings, error } = await auth.supabase
      .from('merchant_feature_settings')
      .select(MERCHANT_FEATURE_SELECT_FIELDS)
      .eq('merchant_id', access.merchantId)
      .single();

    if (error && error.code === 'PGRST116') {
      // No settings exist, create with defaults
      const { data: newSettings, error: createError } = await auth.supabase
        .from('merchant_feature_settings')
        .insert({
          merchant_id: access.merchantId,
          ...DEFAULT_SETTINGS,
        })
        .select()
        .single();

      if (createError) {
        console.error('Error creating feature settings:', createError);
        return NextResponse.json(
          { error: 'Failed to create settings' },
          { status: 500 }
        );
      }

      settings = newSettings;
    } else if (error) {
      console.error('Error fetching feature settings:', error);
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      );
    }

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Feature settings GET error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    let updates: Record<string, unknown>;
    try {
      updates = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedUpdates = merchantFeatureSettingsSchema
      .partial()
      .safeParse(updates);
    if (!parsedUpdates.success) {
      return NextResponse.json(
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

    // Upsert settings
    const { data: settings, error } = await auth.supabase
      .from('merchant_feature_settings')
      .upsert(
        {
          merchant_id: access.merchantId,
          ...sanitizedUpdates,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'merchant_id',
        }
      )
      .select()
      .single();

    if (error) {
      console.error('Error updating feature settings:', error);
      return NextResponse.json(
        { error: 'Failed to update settings' },
        { status: 500 }
      );
    }

    // Invalidate cache
    revalidateFeatures(access.merchantId);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Feature settings PATCH error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const { valid, response } = await checkCsrfProtection(request);
    if (!valid) {
      return (
        response ??
        NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 })
      );
    }

    const auth = await authenticateApiRequest(request);
    if (auth.error || !auth.user || !auth.supabase) {
      return NextResponse.json(
        { error: auth.error || 'Unauthorized' },
        { status: 401 }
      );
    }

    const access = await getUserAccess(auth.supabase);
    if (!access) {
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    if (!hasPermission(access, 'settings', 'edit')) {
      return NextResponse.json({ error: 'Permission denied' }, { status: 403 });
    }

    let newSettings: Record<string, unknown>;
    try {
      newSettings = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsedSettings = merchantFeatureSettingsSchema
      .partial()
      .safeParse(newSettings);
    if (!parsedSettings.success) {
      return NextResponse.json(
        {
          error: 'Invalid input',
          details: parsedSettings.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }
    const sanitizedSettings = parsedSettings.data;

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
      .select()
      .single();

    if (error) {
      console.error('Error replacing feature settings:', error);
      return NextResponse.json(
        { error: 'Failed to save settings' },
        { status: 500 }
      );
    }

    // Invalidate cache
    revalidateFeatures(access.merchantId);

    return NextResponse.json(settings);
  } catch (error) {
    console.error('Feature settings PUT error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
