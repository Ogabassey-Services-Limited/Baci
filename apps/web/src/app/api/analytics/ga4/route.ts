import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import { fetchAnalyticsPlatformConfig } from '@/lib/analytics/analytics-platform-config';
import type { GA4UserData } from '@/lib/ga4-measurement-protocol';
import {
  extractClientIdFromCookie,
  ga4MeasurementProtocol,
  generateClientId,
} from '@/lib/ga4-measurement-protocol';
import { createClient } from '@/lib/supabase/server';

/**
 * GA4 Measurement Protocol API Endpoint
 *
 * Server-side endpoint for sending events to GA4.
 * This should be called from checkout/purchase flows for accurate tracking.
 *
 * Required merchant settings:
 * - google_analytics_id: The GA4 Measurement ID (G-XXXXXXXXXX)
 * - ga4_api_secret: The Measurement Protocol API secret
 */

interface GA4EventRequest {
  event: 'purchase' | 'begin_checkout' | 'add_to_cart' | 'view_item' | 'search';
  merchantId: string;
  userData?: {
    email?: string;
    userId?: string;
  };
  eventData: {
    value?: number;
    currency?: string;
    transactionId?: string;
    searchTerm?: string;
    products?: Array<{
      id: string;
      name: string;
      price: number;
      quantity: number;
      category?: string;
    }>;
  };
  clientId?: string; // From _ga cookie
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as GA4EventRequest;
    const { event, merchantId, userData, eventData, clientId } = body;

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

    const measurementId = merchant.google_analytics_id as string | null;
    const apiSecret = merchant.ga4_api_secret as string | null;

    if (!measurementId || !apiSecret) {
      // Silently succeed if GA4 server-side isn't configured
      return NextResponse.json({
        success: true,
        message: 'GA4 Measurement Protocol not configured for this merchant',
        sent: false,
      });
    }

    // Build user data
    const ga4UserData: GA4UserData = {
      clientId:
        clientId ||
        extractClientIdFromCookie(request.cookies.get('_ga')?.value) ||
        generateClientId(),
      userId: userData?.userId,
      ipAddress:
        request.headers.get('x-forwarded-for')?.split(',')[0] ||
        request.headers.get('x-real-ip') ||
        undefined,
      userAgent: request.headers.get('user-agent') || undefined,
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
        result = await ga4MeasurementProtocol.purchase(
          measurementId,
          apiSecret,
          ga4UserData,
          eventData.transactionId,
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
        result = await ga4MeasurementProtocol.beginCheckout(
          measurementId,
          apiSecret,
          ga4UserData,
          eventData.value || 0,
          currency,
          eventData.products
        );
        break;

      case 'add_to_cart':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'add_to_cart event requires at least one product' },
            { status: 400 }
          );
        }
        result = await ga4MeasurementProtocol.addToCart(
          measurementId,
          apiSecret,
          ga4UserData,
          eventData.products[0].id,
          eventData.products[0].name,
          eventData.products[0].price,
          eventData.products[0].quantity,
          currency
        );
        break;

      case 'view_item':
        if (!eventData.products?.[0]) {
          return NextResponse.json(
            { error: 'view_item event requires at least one product' },
            { status: 400 }
          );
        }
        result = await ga4MeasurementProtocol.viewItem(
          measurementId,
          apiSecret,
          ga4UserData,
          eventData.products[0].id,
          eventData.products[0].name,
          eventData.products[0].price,
          currency,
          eventData.products[0].category
        );
        break;

      case 'search':
        if (!eventData.searchTerm) {
          return NextResponse.json(
            { error: 'search event requires searchTerm' },
            { status: 400 }
          );
        }
        result = await ga4MeasurementProtocol.search(
          measurementId,
          apiSecret,
          ga4UserData,
          eventData.searchTerm
        );
        break;

      default:
        return NextResponse.json(
          { error: `Unsupported event type: ${event}` },
          { status: 400 }
        );
    }

    if (!result.success) {
      console.error('GA4 Measurement Protocol error:', result.error);
      return NextResponse.json({
        success: false,
        error: result.error,
      });
    }

    return NextResponse.json({
      success: true,
    });
  } catch (error) {
    console.error('GA4 endpoint error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
