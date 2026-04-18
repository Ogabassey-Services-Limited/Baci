import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { isPaystackCheckoutAvailable } from '@/lib/checkout/payment-gateway-availability';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

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
  creditDirectMinAmount: number;
  creditDirectMaxAmount: number;
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
}

// Default public features
const DEFAULT_FEATURES: StorefrontFeatures = {
  loyaltyEnabled: false,
  reviewsEnabled: true,
  wishlistEnabled: true,
  orderTrackingEnabled: true,
  discountCodesEnabled: true,
  guestCheckoutEnabled: true,
  // Payment gateways
  paystackEnabled: true,
  korapayEnabled: true,
  payOnDeliveryEnabled: false,
  creditDirectEnabled: false,
  credpalEnabled: false,
  creditDirectMinAmount: 10000,
  creditDirectMaxAmount: 500000,
  preferredLocalGateway: 'paystack',
  preferredInternationalGateway: 'korapay',
  shippingProviders: ['gigl', 'topship'],
  freeShippingThreshold: null,
  collectPhone: true,
  requireAccount: false,
  showOrderNotes: true,
  pages: {
    about: true,
    contact: true,
    faq: true,
    privacy: true,
    terms: true,
    rewards: false,
  },
  showRecentPurchases: false,
  showStockLevels: true,
  lowStockThreshold: 10,
  hasGoogleAnalytics: false,
  hasFacebookPixel: false,
  hasTiktokPixel: false,
  // VTU defaults
  vtuEnabled: false,
  vtuAirtimeEnabled: true,
  vtuDataEnabled: true,
  vtuCheckoutAddonEnabled: false,
  vtuCheckoutAddonAmounts: [100, 200, 500, 1000],
  vtuLoyaltyRewardEnabled: false,
  // Blog defaults
  blogEnabled: false,
  autoBlogEnabled: false,
};

const storefrontFeaturesQuerySchema = z
  .object({
    merchantId: z.string().uuid({ message: 'Invalid merchantId' }).optional(),
    slug: z.string().trim().min(1).max(255).optional(),
  })
  .refine(({ merchantId, slug }) => Boolean(merchantId || slug), {
    message: 'merchantId or slug is required',
  });

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

    if (!slug && !merchantId) {
      return NextResponse.json(
        { error: 'merchantId or slug is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const merchantLookupQuery = supabase
      .from('merchants')
      .select('id, paystack_subaccount_code');
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

    // Get feature settings
    const { data: settings, error: settingsError } = await supabase
      .from('merchant_feature_settings')
      .select(
        'loyalty_enabled, reviews_enabled, wishlist_enabled, order_tracking_enabled, discount_codes_enabled, guest_checkout_enabled, paystack_enabled, korapay_enabled, pay_on_delivery_enabled, credit_direct_enabled, credpal_enabled, credit_direct_min_amount, credit_direct_max_amount, preferred_local_gateway, preferred_international_gateway, shipping_providers, free_shipping_threshold, checkout_collect_phone, checkout_require_account, checkout_show_order_notes, about_page_enabled, contact_page_enabled, faq_page_enabled, privacy_page_enabled, terms_page_enabled, rewards_page_enabled, show_recent_purchases, show_stock_levels, low_stock_threshold, google_analytics_id, facebook_pixel_id, tiktok_pixel_id, vtu_enabled, vtu_airtime_enabled, vtu_data_enabled, vtu_checkout_addon_enabled, vtu_checkout_addon_amounts, vtu_loyalty_reward_enabled, blog_enabled, auto_blog_enabled'
      )
      .eq('merchant_id', resolvedMerchantId)
      .single();

    if (settingsError && settingsError.code !== 'PGRST116') {
      logger.error({
        message: 'Storefront features settings lookup failed',
        error: settingsError,
        merchantId: resolvedMerchantId,
      });
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }

    // If no settings, return defaults
    if (!settings) {
      return NextResponse.json({
        ...DEFAULT_FEATURES,
        paystackEnabled: isPaystackCheckoutAvailable({
          paystack_subaccount_code: merchant.paystack_subaccount_code,
          feature_settings: {
            paystack_enabled: DEFAULT_FEATURES.paystackEnabled,
          },
        }),
      });
    }

    // Transform to public format (hide sensitive data like pixel IDs)
    const publicFeatures: StorefrontFeatures = {
      loyaltyEnabled: settings.loyalty_enabled ?? false,
      reviewsEnabled: settings.reviews_enabled ?? true,
      wishlistEnabled: settings.wishlist_enabled ?? true,
      orderTrackingEnabled: settings.order_tracking_enabled ?? true,
      discountCodesEnabled: settings.discount_codes_enabled ?? true,
      guestCheckoutEnabled: settings.guest_checkout_enabled ?? true,
      // Payment gateways
      paystackEnabled: isPaystackCheckoutAvailable({
        paystack_subaccount_code: merchant.paystack_subaccount_code,
        feature_settings: {
          paystack_enabled: settings.paystack_enabled ?? true,
        },
      }),
      korapayEnabled: settings.korapay_enabled ?? true,
      payOnDeliveryEnabled: settings.pay_on_delivery_enabled ?? false,
      creditDirectEnabled: settings.credit_direct_enabled ?? false,
      credpalEnabled: settings.credpal_enabled ?? false,
      creditDirectMinAmount: settings.credit_direct_min_amount ?? 10000,
      creditDirectMaxAmount: settings.credit_direct_max_amount ?? 500000,
      preferredLocalGateway: settings.preferred_local_gateway || 'paystack',
      preferredInternationalGateway:
        settings.preferred_international_gateway || 'korapay',
      shippingProviders: settings.shipping_providers ?? ['gigl', 'topship'],
      freeShippingThreshold: settings.free_shipping_threshold,
      collectPhone: settings.checkout_collect_phone ?? true,
      requireAccount: settings.checkout_require_account ?? false,
      showOrderNotes: settings.checkout_show_order_notes ?? true,
      pages: {
        about: settings.about_page_enabled ?? true,
        contact: settings.contact_page_enabled ?? true,
        faq: settings.faq_page_enabled ?? true,
        privacy: settings.privacy_page_enabled ?? true,
        terms: settings.terms_page_enabled ?? true,
        rewards: settings.rewards_page_enabled ?? false,
      },
      showRecentPurchases: settings.show_recent_purchases ?? false,
      showStockLevels: settings.show_stock_levels ?? true,
      lowStockThreshold: settings.low_stock_threshold ?? 10,
      hasGoogleAnalytics: !!settings.google_analytics_id,
      hasFacebookPixel: !!settings.facebook_pixel_id,
      hasTiktokPixel: !!settings.tiktok_pixel_id,
      // VTU
      vtuEnabled: settings.vtu_enabled ?? false,
      vtuAirtimeEnabled: settings.vtu_airtime_enabled ?? true,
      vtuDataEnabled: settings.vtu_data_enabled ?? true,
      vtuCheckoutAddonEnabled: settings.vtu_checkout_addon_enabled ?? false,
      vtuCheckoutAddonAmounts: settings.vtu_checkout_addon_amounts || [
        100, 200, 500, 1000,
      ],
      vtuLoyaltyRewardEnabled: settings.vtu_loyalty_reward_enabled ?? false,
      // Blog
      blogEnabled: settings.blog_enabled ?? false,
      autoBlogEnabled: settings.auto_blog_enabled ?? false,
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
