/**
 * Shipping Quotes API
 * GET aggregated shipping quotes from all providers
 *
 * Uses the admin (service-role) client instead of the cookie-based SSR client
 * because this route is called from the mobile storefront app, which sends a
 * Bearer token in the Authorization header rather than Supabase session cookies.
 * The cookie-based client always resolves to an unauthenticated session for
 * mobile requests. To validate the caller's JWT we extract the raw token from
 * the Authorization header and pass it to supabase.auth.getUser(token) explicitly,
 * Mobile Bearer tokens are validated explicitly; web requests use the
 * request-bound cookie client before service-role quote storage.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { shippingService } from '@/lib/shipping';
import type { QuoteRequest, QuoteResponse } from '@/lib/shipping/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { QuoteRequestSchema } from '@/schemas/shipping';
import { resolveQuoteMerchantContext } from './quote-merchant-context';

// =============================================================================
// POST /api/shipping/quotes - Get shipping quotes
// =============================================================================

export async function POST(request: NextRequest) {
  try {
    // CSRF: handled by Origin-based middleware in proxy.ts (guest storefront route)
    const body = await request.json();

    // Validate request
    const parseResult = QuoteRequestSchema.safeParse(body);
    if (!parseResult.success) {
      return NextResponse.json(
        {
          error: 'Invalid request',
          details: parseResult.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const data = parseResult.data;

    // Single admin client instance for the lifetime of this request.
    // The service-role key bypasses RLS for quote storage. For auth we
    // pass the raw JWT explicitly so it works for both web (cookie) and
    // mobile (Authorization: Bearer <token>) callers.
    const supabase = createAdminClient();

    const merchantContext = await resolveQuoteMerchantContext({
      data,
      request,
      supabase,
    });
    if (!merchantContext.ok) {
      return NextResponse.json(
        { error: merchantContext.error },
        { status: merchantContext.status }
      );
    }
    // Every registered carrier (Topship/GIGL) is Nigerian and quotes are
    // NGN-denominated with a Nigeria origin. For a non-Nigerian merchant
    // those quotes would be wrong in both origin and currency (and would be
    // summed into a non-NGN order total with no conversion), so return an
    // empty quote set instead.
    const merchantCountry = merchantContext.merchantCountry
      ?.trim()
      .toUpperCase();
    if (merchantCountry && merchantCountry !== 'NG') {
      const emptyResponse: QuoteResponse = {
        quotes: { featured: [], all: [] },
        sessionId: data.sessionId || crypto.randomUUID(),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
        warnings: [
          'Carrier shipping rates are currently available for Nigerian merchants only.',
        ],
      };
      return NextResponse.json(emptyResponse);
    }

    let senderInfo = merchantContext.senderInfo;

    if (!senderInfo && data.shipmentType === 'international') {
      return NextResponse.json(
        { error: 'Sender is required for international quotes' },
        { status: 400 }
      );
    }

    // Default sender if no merchant found
    if (!senderInfo) {
      senderInfo = {
        name: 'Merchant',
        phone: '',
        address: 'Lagos',
        city: 'Lagos',
        state: 'Lagos',
        country: 'Nigeria',
        countryCode: 'NG',
      };
    }

    // Build quote request
    const quoteRequest: QuoteRequest = {
      merchantId: merchantContext.merchantId,
      sender: senderInfo,
      receiver: {
        ...data.receiver,
        phone: data.receiver.phone || '', // Default to empty string for type safety
        country: data.receiver.country,
        countryCode: data.receiver.countryCode,
      },
      items: data.items,
      sessionId: data.sessionId || crypto.randomUUID(),
      shipmentType: data.shipmentType,
      deliveryPreference: data.deliveryPreference,
    };

    // Get quotes from all providers
    const response = await shippingService.getQuotes(quoteRequest);

    // Store all quotes (for later reference during booking)
    await Promise.all(
      response.quotes.all.map((quote) =>
        supabase.from('shipping_quotes').upsert(
          {
            id: quote.id,
            merchant_id: quoteRequest.merchantId ?? null,
            session_id: response.sessionId,
            provider: quote.provider,
            service_tier: quote.serviceTier,
            carrier_name: quote.carrierName,
            price: quote.price,
            currency: quote.currency,
            estimated_days: quote.estimatedDays,
            min_days: quote.minDays,
            max_days: quote.maxDays,
            pickup_included: quote.pickupIncluded,
            insurance_included: quote.insuranceIncluded,
            is_station_pickup: quote.isStationPickup || false,
            station_name: quote.stationName,
            station_address: quote.stationAddress,
            provider_rate_id: quote.providerRateId,
            provider_metadata: quote.rawResponse,
            expires_at: quote.expiresAt.toISOString(),
            quote_request: quoteRequest,
          },
          { onConflict: 'id' }
        )
      )
    );

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error getting shipping quotes:', error);
    return NextResponse.json(
      { error: 'Failed to get shipping quotes' },
      { status: 500 }
    );
  }
}

// =============================================================================
// GET /api/shipping/quotes?sessionId=xxx - Get cached quotes by session ID
// =============================================================================

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get('sessionId');

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID required' },
        { status: 400 }
      );
    }

    const supabase = createAdminClient();

    const { data: quotes, error } = await supabase
      .from('shipping_quotes')
      .select(
        'id, session_id, provider, service_tier, carrier_name, estimated_days, min_days, max_days, price, currency, pickup_included, insurance_included, is_station_pickup, station_name, station_address, provider_rate_id, expires_at'
      )
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching quotes:', error);
      return NextResponse.json(
        { error: 'Failed to fetch quotes' },
        { status: 500 }
      );
    }

    if (!quotes || quotes.length === 0) {
      return NextResponse.json(
        { error: 'Quotes expired or not found' },
        { status: 404 }
      );
    }

    // Transform to ShippingQuote format
    const transformedQuotes = quotes.map((q) => ({
      id: q.id,
      provider: q.provider,
      serviceTier: q.service_tier,
      carrierName: q.carrier_name,
      displayName: q.carrier_name,
      estimatedDays: q.estimated_days,
      minDays: q.min_days,
      maxDays: q.max_days,
      price: q.price,
      currency: q.currency,
      pickupIncluded: q.pickup_included,
      insuranceIncluded: q.insurance_included,
      isStationPickup: q.is_station_pickup,
      stationName: q.station_name,
      stationAddress: q.station_address,
      providerRateId: q.provider_rate_id,
      expiresAt: new Date(q.expires_at),
    }));

    return NextResponse.json({
      quotes: {
        featured: transformedQuotes.slice(0, 3),
        all: transformedQuotes,
      },
      sessionId,
      expiresAt: quotes[0]?.expires_at,
    });
  } catch (error) {
    console.error('Error fetching cached quotes:', error);
    return NextResponse.json(
      { error: 'Failed to fetch quotes' },
      { status: 500 }
    );
  }
}
