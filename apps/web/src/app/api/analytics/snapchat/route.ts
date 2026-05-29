import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchAnalyticsPlatformConfig } from '@/lib/analytics/analytics-platform-config';
import type { SnapchatUserData } from '@/lib/snapchat-capi';
import { snapchatCAPI } from '@/lib/snapchat-capi';
import { createClient } from '@/lib/supabase/server';

/**
 * Snapchat Conversions API Endpoint
 *
 * Server-side endpoint for sending events to Snapchat.
 * This should be called from checkout/purchase flows for accurate tracking.
 *
 * Required merchant settings:
 * - snapchat_pixel_id: The Snapchat Pixel ID
 * - snapchat_capi_token: The Conversions API access token
 */

interface SnapchatEventRequest {
  event: 'purchase' | 'begin_checkout' | 'add_to_cart';
  merchantId: string;
  userData?: {
    email?: string;
    phone?: string;
  };
  eventData: {
    value?: number;
    currency?: string;
    transactionId?: string;
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
    const body = (await request.json()) as SnapchatEventRequest;
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

    const pixelId = merchant.snapchat_pixel_id as string | null;
    const accessToken = merchant.snapchat_capi_token as string | null;

    if (!pixelId || !accessToken) {
      // Silently succeed if Snapchat server-side isn't configured
      return NextResponse.json({
        success: true,
        message: 'Snapchat CAPI not configured for this merchant',
        sent: false,
      });
    }

    // Build user data
    const snapUserData: SnapchatUserData = {
      email: userData?.email,
      phone: userData?.phone,
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
      clickId: request.cookies.get('ScCid')?.value, // Snapchat click ID
    };

    const currency = eventData.currency || 'NGN';
    let result: { success: boolean; error?: string };

    switch (event) {
      case 'purchase':
        if (
          !eventData.products ||
          !eventData.value ||
          !eventData.transactionId
        ) {
          return NextResponse.json(
            {
              error:
                'Purchase event requires products, value, and transactionId',
            },
            { status: 400 }
          );
        }
        result = await snapchatCAPI.purchase(
          pixelId,
          accessToken,
          snapUserData,
          eventData.transactionId,
          eventData.value,
          currency,
          eventData.products.map((p) => p.id)
        );
        break;

      case 'begin_checkout':
        if (!eventData.products) {
          return NextResponse.json(
            { error: 'begin_checkout event requires products' },
            { status: 400 }
          );
        }
        result = await snapchatCAPI.startCheckout(
          pixelId,
          accessToken,
          snapUserData,
          eventData.value || 0,
          currency,
          eventData.products.map((p) => p.id)
        );
        break;

      case 'add_to_cart':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'add_to_cart event requires at least one product' },
            { status: 400 }
          );
        }
        result = await snapchatCAPI.addToCart(
          pixelId,
          accessToken,
          snapUserData,
          eventData.products[0].id,
          eventData.products[0].price,
          currency
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported event type: ${event}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error('Snapchat CAPI error:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('Snapchat endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
