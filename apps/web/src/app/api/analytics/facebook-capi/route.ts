import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchAnalyticsPlatformConfig } from '@/lib/analytics/analytics-platform-config';
import type { FacebookUserData } from '@/lib/facebook-capi';
import { facebookCAPI, generateEventId } from '@/lib/facebook-capi';
import { createClient } from '@/lib/supabase/server';

/**
 * Facebook Conversions API Endpoint
 *
 * Server-side endpoint for sending events to Facebook CAPI.
 * This should be called from checkout/purchase flows for accurate tracking.
 *
 * Required merchant settings:
 * - facebook_pixel_id: The Facebook Pixel ID
 * - facebook_capi_token: The Conversions API access token (from Events Manager)
 */

interface CAPIEventRequest {
  event: 'Purchase' | 'InitiateCheckout' | 'AddToCart' | 'ViewContent';
  merchantId: string;
  userData: {
    email?: string;
    phone?: string;
    firstName?: string;
    lastName?: string;
    city?: string;
    state?: string;
    zipCode?: string;
    country?: string;
    externalId?: string;
  };
  eventData: {
    value?: number;
    currency?: string;
    orderId?: string;
    products?: Array<{
      id: string;
      name: string;
      quantity: number;
      price: number;
    }>;
  };
  eventSourceUrl?: string;
  eventId?: string; // For deduplication with client-side pixel
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as CAPIEventRequest;
    const { event, merchantId, userData, eventData, eventSourceUrl, eventId } =
      body;

    if (!merchantId || !event) {
      return NextResponse.json(
        { error: 'Missing required fields: merchantId, event' },
        { status: 400 }
      );
    }

    // Get merchant settings to retrieve CAPI credentials
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

    const pixelId = merchant.facebook_pixel_id as string | null;
    const accessToken = merchant.facebook_capi_token as string | null;

    if (!pixelId || !accessToken) {
      // Silently succeed if CAPI isn't configured - merchant may only use client-side pixel
      return NextResponse.json({
        success: true,
        message: 'CAPI not configured for this merchant',
        sent: false,
      });
    }

    // Build user data with request headers
    const fbUserData: FacebookUserData = {
      ...userData,
      clientIpAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        undefined,
      clientUserAgent: request.headers.get('user-agent') || undefined,
      // Extract Facebook cookies if passed
      fbc: request.cookies.get('_fbc')?.value,
      fbp: request.cookies.get('_fbp')?.value,
    };

    // Generate event ID for deduplication if not provided
    const finalEventId = eventId || generateEventId();
    const currency = eventData.currency || 'USD';

    // biome-ignore lint/suspicious/noExplicitAny: External API response
    let result: { success: boolean; error?: string; response?: any };

    switch (event) {
      case 'Purchase':
        if (!eventData.products || !eventData.value) {
          return NextResponse.json(
            { error: 'Purchase event requires products and value' },
            { status: 400 }
          );
        }
        result = await facebookCAPI.purchase(
          pixelId,
          accessToken,
          fbUserData,
          eventData.orderId || finalEventId,
          eventData.value,
          currency,
          eventData.products,
          eventSourceUrl
        );
        break;

      case 'InitiateCheckout':
        result = await facebookCAPI.initiateCheckout(
          pixelId,
          accessToken,
          fbUserData,
          eventData.value || 0,
          currency,
          eventData.products?.map((p) => ({
            id: p.id,
            quantity: p.quantity,
          })) || [],
          eventSourceUrl
        );
        break;

      case 'AddToCart':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'AddToCart event requires at least one product' },
            { status: 400 }
          );
        }
        result = await facebookCAPI.addToCart(
          pixelId,
          accessToken,
          fbUserData,
          eventData.products[0].id,
          eventData.products[0].name,
          eventData.value || eventData.products[0].price,
          currency,
          eventSourceUrl
        );
        break;

      case 'ViewContent':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'ViewContent event requires at least one product' },
            { status: 400 }
          );
        }
        result = await facebookCAPI.viewContent(
          pixelId,
          accessToken,
          fbUserData,
          eventData.products[0].id,
          eventData.products[0].name,
          eventData.value || eventData.products[0].price,
          currency,
          undefined,
          eventSourceUrl
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported event type: ${event}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error('Facebook CAPI error:', result.error);
      // Don't fail the request - CAPI errors shouldn't break checkout
      return NextResponse.json({
        success: false,
        error: result.error,
        eventId: finalEventId,
      });
    }

    return NextResponse.json({
      success: true,
      eventId: finalEventId,
      eventsReceived: result.response?.events_received,
    });
  } catch (error) {
    console.error('CAPI endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
