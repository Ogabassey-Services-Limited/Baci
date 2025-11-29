import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient } from '@/lib/supabase/server';
import { tiktokEventsAPI } from '@/lib/tiktok-events-api';
import type { TikTokUserData } from '@/lib/tiktok-events-api';

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
  event: 'purchase' | 'begin_checkout' | 'add_to_cart' | 'view_item';
  merchantId: string;
  userData?: {
    email?: string;
    phone?: string;
    externalId?: string;
  };
  eventData: {
    value?: number;
    currency?: string;
    orderId?: string;
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
    const { data: merchant, error: merchantError } = await supabase
      .from('merchants')
      .select('tiktok_pixel_id, tiktok_access_token')
      .eq('id', merchantId)
      .single();

    if (merchantError || !merchant) {
      console.error('Failed to fetch merchant:', merchantError);
      return NextResponse.json({ error: 'Merchant not found' }, { status: 404 });
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
      userAgent: request.headers.get('user-agent') || undefined,
      ttp: request.cookies.get('_ttp')?.value, // TikTok click ID
    };

    const currency = eventData.currency || 'NGN';
    let result;

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
          eventData.products
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
          eventData.value || 0,
          currency,
          eventData.products.map((p) => p.id)
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
