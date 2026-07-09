import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { getCachedFeatureSettings } from '@/lib/cached-data';
import { isPaystackCheckoutAvailable } from '@/lib/checkout/payment-gateway-availability';
import { logger } from '@/lib/logger';
import { isRepairsCatalogEnabled } from '@/lib/repairs/repairs-feature';
import { createClient } from '@/lib/supabase/server';
import { storefrontFeaturesQuerySchema } from '@/schemas/storefront-features';

/**
 * Storefront Feature Settings API (Public)
 *
 * GET - Get public feature settings for a store
 *
 * Query params:
 * - merchantId: string (required) - The merchant's ID
 * - slug: string (alternative) - The merchant's slug
 */

export interface StorefrontFeatures {
  // Feature availability
  loyaltyEnabled: boolean;
  reviewsEnabled: boolean;
  wishlistEnabled: boolean;
  orderTrackingEnabled: boolean;
  discountCodesEnabled: boolean;
  guestCheckoutEnabled: boolean;

  // Payment gateways
  paystackEnabled: boolean;
  korapayEnabled: boolean;
  payOnDeliveryEnabled: boolean;
  creditDirectEnabled: boolean;
  credpalEnabled: boolean;
  klumpEnabled: boolean;
  creditDirectMinAmount: number;
  creditDirectMaxAmount: number;
  klumpMinAmount: number;
  klumpMaxAmount: number;
  preferredLocalGateway: 'paystack' | 'korapay';
  preferredInternationalGateway: 'paystack' | 'korapay';

  // Shipping
  shippingProviders: string[];
  freeShippingThreshold: number | null;

  // Checkout
  collectPhone: boolean;
  requireAccount: boolean;
  showOrderNotes: boolean;

  // Store pages
  pages: {
    about: boolean;
    contact: boolean;
    faq: boolean;
    privacy: boolean;
    terms: boolean;
    rewards: boolean;
  };

  // Social proof
  showRecentPurchases: boolean;
  showStockLevels: boolean;
  lowStockThreshold: number;

  // Analytics (IDs only, merchants configure these)
  hasGoogleAnalytics: boolean;
  hasFacebookPixel: boolean;
  hasTiktokPixel: boolean;

  // VTU (Airtime/Data)
  vtuEnabled: boolean;
  vtuAirtimeEnabled: boolean;
  vtuDataEnabled: boolean;
  vtuCheckoutAddonEnabled: boolean;
  vtuCheckoutAddonAmounts: number[];
  vtuLoyaltyRewardEnabled: boolean;

  // Blog
  blogEnabled: boolean;
  autoBlogEnabled: boolean;

  // Repairs
  repairsCatalogEnabled: boolean;
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function asNullableNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asStringArray(value: unknown, fallback: string[]): string[] {
  return Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : fallback;
}

function asNumberArray(value: unknown, fallback: number[]): number[] {
  const parsed = Array.isArray(value)
    ? value.filter((entry): entry is number => typeof entry === 'number')
    : [];
  return parsed.length > 0 ? parsed : fallback;
}

function asGateway(
  value: unknown,
  fallback: 'paystack' | 'korapay'
): 'paystack' | 'korapay' {
  return value === 'paystack' || value === 'korapay' ? value : fallback;
}

function normalizePreferredGateway(
  gateway: 'paystack' | 'korapay',
  paystackEnabled: boolean
): 'paystack' | 'korapay' {
  return !paystackEnabled && gateway === 'paystack' ? 'korapay' : gateway;
}

export async function GET(request: NextRequest) {
  try {
    const parseResult = storefrontFeaturesQuerySchema.safeParse({
      merchantId: request.nextUrl.searchParams.get('merchantId') || undefined,
      slug: request.nextUrl.searchParams.get('slug') || undefined,
    });

    if (!parseResult.success) {
      return NextResponse.json(
        {
          error:
            parseResult.error.issues[0]?.message ?? 'Invalid query parameters',
        },
        { status: 400 }
      );
    }

    const { merchantId, slug } = parseResult.data;

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const merchantLookupQuery = supabase
      .from('merchants')
      .select('id, country, paystack_subaccount_code, business_type');
    const merchantLookup = slug
      ? await merchantLookupQuery.eq('slug', slug).single()
      : await merchantLookupQuery.eq('id', merchantId).single();

    if (merchantLookup.error) {
      if (merchantLookup.error.code === 'PGRST116') {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }

      logger.error({
        message: 'Storefront features merchant lookup failed',
        error: merchantLookup.error,
        merchantId,
        slug,
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    const merchant = merchantLookup.data;
    if (!merchant) {
      return NextResponse.json({ error: 'Store not found' }, { status: 404 });
    }
    const resolvedMerchantId = merchant.id;

    // Read the public-safe feature projection via the service role so anonymous
    // and signed-in customers see real values (the anon-key table read only
    // returns rows to the owner/staff under the merchant_feature_settings RLS).
    const settings = (await getCachedFeatureSettings(resolvedMerchantId)) ?? {};

    const paystackEnabled = isPaystackCheckoutAvailable({
      country: merchant.country,
      paystack_subaccount_code: merchant.paystack_subaccount_code,
      feature_settings: {
        paystack_enabled: asBoolean(settings.paystack_enabled, true),
      },
    });

    // Transform to public format (hide sensitive data like pixel IDs)
    const publicFeatures: StorefrontFeatures = {
      loyaltyEnabled: asBoolean(settings.loyalty_enabled, false),
      reviewsEnabled: asBoolean(settings.reviews_enabled, true),
      wishlistEnabled: asBoolean(settings.wishlist_enabled, true),
      orderTrackingEnabled: asBoolean(settings.order_tracking_enabled, true),
      discountCodesEnabled: asBoolean(settings.discount_codes_enabled, true),
      guestCheckoutEnabled: asBoolean(settings.guest_checkout_enabled, true),
      // Payment gateways
      paystackEnabled,
      korapayEnabled: asBoolean(settings.korapay_enabled, true),
      payOnDeliveryEnabled: asBoolean(settings.pay_on_delivery_enabled, false),
      creditDirectEnabled: asBoolean(settings.credit_direct_enabled, false),
      credpalEnabled: asBoolean(settings.credpal_enabled, false),
      klumpEnabled: asBoolean(settings.klump_enabled, false),
      creditDirectMinAmount: asNumber(settings.credit_direct_min_amount, 10000),
      creditDirectMaxAmount: asNumber(
        settings.credit_direct_max_amount,
        500000
      ),
      klumpMinAmount: asNumber(settings.klump_min_amount, 10000),
      klumpMaxAmount: asNumber(settings.klump_max_amount, 1000000),
      preferredLocalGateway: normalizePreferredGateway(
        asGateway(settings.preferred_local_gateway, 'paystack'),
        paystackEnabled
      ),
      preferredInternationalGateway: normalizePreferredGateway(
        asGateway(settings.preferred_international_gateway, 'korapay'),
        paystackEnabled
      ),
      shippingProviders: asStringArray(settings.shipping_providers, [
        'gigl',
        'topship',
      ]),
      freeShippingThreshold: asNullableNumber(settings.free_shipping_threshold),
      collectPhone: asBoolean(settings.checkout_collect_phone, true),
      requireAccount: asBoolean(settings.checkout_require_account, false),
      showOrderNotes: asBoolean(settings.checkout_show_order_notes, true),
      pages: {
        about: asBoolean(settings.about_page_enabled, true),
        contact: asBoolean(settings.contact_page_enabled, true),
        faq: asBoolean(settings.faq_page_enabled, true),
        privacy: asBoolean(settings.privacy_page_enabled, true),
        terms: asBoolean(settings.terms_page_enabled, true),
        rewards: asBoolean(settings.rewards_page_enabled, false),
      },
      showRecentPurchases: asBoolean(settings.show_recent_purchases, false),
      showStockLevels: asBoolean(settings.show_stock_levels, true),
      lowStockThreshold: asNumber(settings.low_stock_threshold, 10),
      hasGoogleAnalytics: Boolean(settings.google_analytics_id),
      hasFacebookPixel: Boolean(settings.facebook_pixel_id),
      hasTiktokPixel: Boolean(settings.tiktok_pixel_id),
      // VTU
      vtuEnabled: asBoolean(settings.vtu_enabled, false),
      vtuAirtimeEnabled: asBoolean(settings.vtu_airtime_enabled, true),
      vtuDataEnabled: asBoolean(settings.vtu_data_enabled, true),
      vtuCheckoutAddonEnabled: asBoolean(
        settings.vtu_checkout_addon_enabled,
        false
      ),
      vtuCheckoutAddonAmounts: asNumberArray(
        settings.vtu_checkout_addon_amounts,
        [100, 200, 500, 1000]
      ),
      vtuLoyaltyRewardEnabled: asBoolean(
        settings.vtu_loyalty_reward_enabled,
        false
      ),
      // Blog
      blogEnabled: asBoolean(settings.blog_enabled, false),
      autoBlogEnabled: asBoolean(settings.auto_blog_enabled, false),
      // Repairs
      repairsCatalogEnabled: isRepairsCatalogEnabled({
        businessType: merchant.business_type,
        repairsCatalogEnabled: asBoolean(
          settings.repairs_catalog_enabled,
          false
        ),
      }),
    };

    return NextResponse.json(publicFeatures);
  } catch (error) {
    logger.error({
      message: 'Storefront features GET error',
      error: error instanceof Error ? error : new Error('Unknown error'),
    });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
