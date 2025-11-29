import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
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
}

// Default public features
const DEFAULT_FEATURES: StorefrontFeatures = {
  loyaltyEnabled: false,
  reviewsEnabled: true,
  wishlistEnabled: true,
  orderTrackingEnabled: true,
  discountCodesEnabled: true,
  guestCheckoutEnabled: true,
  shippingProviders: ['gigl', 'topship', 'shiip'],
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
};

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const merchantId = searchParams.get('merchantId');
    const slug = searchParams.get('slug');

    if (!merchantId && !slug) {
      return NextResponse.json(
        { error: 'merchantId or slug is required' },
        { status: 400 }
      );
    }

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Get merchant ID from slug if needed
    let resolvedMerchantId = merchantId;
    if (!resolvedMerchantId && slug) {
      const { data: merchant } = await supabase
        .from('merchants')
        .select('id')
        .eq('slug', slug)
        .single();

      if (!merchant) {
        return NextResponse.json({ error: 'Store not found' }, { status: 404 });
      }
      resolvedMerchantId = merchant.id;
    }

    // Get feature settings
    const { data: settings } = await supabase
      .from('merchant_feature_settings')
      .select('*')
      .eq('merchant_id', resolvedMerchantId)
      .single();

    // If no settings, return defaults
    if (!settings) {
      return NextResponse.json(DEFAULT_FEATURES);
    }

    // Transform to public format (hide sensitive data like pixel IDs)
    const publicFeatures: StorefrontFeatures = {
      loyaltyEnabled: settings.loyalty_enabled ?? false,
      reviewsEnabled: settings.reviews_enabled ?? true,
      wishlistEnabled: settings.wishlist_enabled ?? true,
      orderTrackingEnabled: settings.order_tracking_enabled ?? true,
      discountCodesEnabled: settings.discount_codes_enabled ?? true,
      guestCheckoutEnabled: settings.guest_checkout_enabled ?? true,
      shippingProviders: settings.shipping_providers ?? ['gigl', 'topship', 'shiip'],
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
    };

    return NextResponse.json(publicFeatures);
  } catch (error) {
    console.error('Storefront features GET error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
