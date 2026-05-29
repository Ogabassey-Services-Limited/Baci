import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchAnalyticsPlatformConfig } from '@/lib/analytics/analytics-platform-config';
import { createClient } from '@/lib/supabase/server';
import type { TikTokUserData } from '@/lib/tiktok-events-api';
import { tiktokEventsAPI } from '@/lib/tiktok-events-api';

/**
 * TikTok Events API Endpoint
 *
 * Server-side endpoint for sending events to TikTok.
 * This should be called from checkout/purchase flows for accurate tracking.
 *
 * Required merchant settings:
 * - tiktok_pixel_id: The TikTok Pixel ID
 * - tiktok_access_token: The Events API access token
 */

interface TikTokEventRequest {
  event:
    | 'purchase'
    | 'begin_checkout'
    | 'add_to_cart'
    | 'view_item'
    | 'search'
    | 'add_payment_info'
    | 'add_to_wishlist'
    | 'complete_registration'
    | 'place_order';
  merchantId: string;
  userData?: {
    email?: string;
    phone?: string;
    externalId?: string;
    ttclid?: string;
    ttp?: string;
  };
  eventData: {
    value?: number;
    currency?: string;
    orderId?: string;
    searchString?: string;
    url?: string;
    products?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
    }>;
  };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as TikTokEventRequest;
    const { event, merchantId, userData, eventData } = body;

    if (!merchantId || !event) {
      return NextResponse.json(
        { error: 'Missing required fields: merchantId, event' },
        { status: 400 }
      );
    }

    // Get merchant settings
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);
    const merchant = await fetchAnalyticsPlatformConfig(supabase, merchantId);

    if (!merchant) {
      console.error('Failed to fetch merchant analytics config');
      return NextResponse.json(
        { error: 'Merchant not found' },
        { status: 404 }
      );
    }

    const pixelId = merchant.tiktok_pixel_id as string | null;
    const accessToken = merchant.tiktok_access_token as string | null;

    if (!pixelId || !accessToken) {
      // Silently succeed if TikTok server-side isn't configured
      return NextResponse.json({
        success: true,
        message: 'TikTok Events API not configured for this merchant',
        sent: false,
      });
    }

    // Build user data
    const tiktokUserData: TikTokUserData = {
      email: userData?.email,
      phone: userData?.phone,
      externalId: userData?.externalId,
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        undefined,
      ttclid: userData?.ttclid,
      userAgent: request.headers.get('user-agent') || undefined,
      ttp: userData?.ttp || request.cookies.get('_ttp')?.value,
    };

    const currency = eventData.currency || 'NGN';
    let result: { success: boolean; error?: string };
    const eventOptions = {
      url: eventData.url,
    };
    const properties = {
      value: eventData.value,
      currency,
      contentIds: eventData.products?.map((p) => p.id),
      contents: eventData.products?.map((product) => ({
        content_id: product.id,
        content_name: product.name,
        price: product.price,
        quantity: product.quantity,
      })),
      orderId: eventData.orderId,
      searchString: eventData.searchString,
      url: eventData.url,
    };

    switch (event) {
      case 'purchase':
        if (!eventData.products || !eventData.value || !eventData.orderId) {
          return NextResponse.json(
            { error: 'Purchase event requires products, value, and orderId' },
            { status: 400 }
          );
        }
        result = await tiktokEventsAPI.purchase(
          pixelId,
          accessToken,
          tiktokUserData,
          eventData.orderId,
          eventData.value,
          currency,
          eventData.products,
          eventOptions
        );
        break;

      case 'begin_checkout':
        if (!eventData.products) {
          return NextResponse.json(
            { error: 'begin_checkout event requires products' },
            { status: 400 }
          );
        }
        result = await tiktokEventsAPI.initiateCheckout(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'add_to_cart':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'add_to_cart event requires at least one product' },
            { status: 400 }
          );
        }
        result = await tiktokEventsAPI.addToCart(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'view_item':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'view_item event requires at least one product' },
            { status: 400 }
          );
        }
        result = await tiktokEventsAPI.viewContent(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'add_to_wishlist':
        result = await tiktokEventsAPI.addToWishlist(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'add_payment_info':
        result = await tiktokEventsAPI.addPaymentInfo(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'place_order':
        result = await tiktokEventsAPI.placeAnOrder(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'complete_registration':
        result = await tiktokEventsAPI.completeRegistration(
          pixelId,
          accessToken,
          tiktokUserData,
          properties,
          eventOptions
        );
        break;

      case 'search':
        if (!eventData.searchString) {
          return NextResponse.json(
            { error: 'search event requires searchString' },
            { status: 400 }
          );
        }
        result = await tiktokEventsAPI.search(
          pixelId,
          accessToken,
          tiktokUserData,
          eventData.searchString,
          eventOptions
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported event type: ${event}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error('TikTok Events API error:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('TikTok endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
