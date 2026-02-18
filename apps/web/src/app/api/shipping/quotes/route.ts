/**
 * Shipping Quotes API
 * GET aggregated shipping quotes from all providers
 */

import { cookies } from 'next/headers';
import { type NextRequest, NextResponse } from 'next/server';
import z from 'zod';
import { hasPermission } from '@/lib/api-auth';
import {
  getMerchantForApiRequest,
  toUserAccess,
} from '@/lib/get-merchant-for-api-request';
import { shippingService } from '@/lib/shipping';
import type { QuoteRequest } from '@/lib/shipping/types';
import { createClient } from '@/lib/supabase/server';

// =============================================================================
// REQUEST VALIDATION
// =============================================================================

const QuoteRequestSchema = z.object({
  // Receiver info (required)
  receiver: z.object({
    name: z.string().min(1),
    email: z.string().email().optional(),
    phone: z.string().optional(), // Optional for quote calculation, required for actual booking
    address: z.string().min(1),
    city: z.string().min(1),
    state: z.string().min(1),
    country: z.string().default('Nigeria'),
    countryCode: z.string().default('NG'),
    postalCode: z.string().optional(),
    stationId: z.number().optional(),
  }),
  // Sender info (optional - uses merchant address)
  sender: z
    .object({
      name: z.string().min(1),
      email: z.string().email().optional(),
      phone: z.string().min(1),
      address: z.string().min(1),
      city: z.string().min(1),
      state: z.string().min(1),
      country: z.string().default('Nigeria'),
      countryCode: z.string().default('NG'),
      postalCode: z.string().optional(),
      stationId: z.number().optional(),
    })
    .optional(),
  // Items (required)
  items: z
    .array(
      z.object({
        name: z.string().min(1),
        quantity: z.number().int().positive(),
        weight: z.number().positive(),
        value: z.number().nonnegative(),
        category: z.string().optional(),
      })
    )
    .min(1),
  // Session ID for quote caching
  sessionId: z.string().optional(),
  // Shipment type
  shipmentType: z.enum(['domestic', 'international']).default('domestic'),
});

// =============================================================================
// POST /api/shipping/quotes - Get shipping quotes
// =============================================================================

export async function POST(request: NextRequest) {
  try {
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

    // Get merchant info for sender details if not provided
    let senderInfo = data.sender;

    if (!senderInfo) {
      const cookieStore = await cookies();
      const supabase = createClient(cookieStore);
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        // Resolve merchant context (supports both owners and staff)
        const merchantContext = await getMerchantForApiRequest(
          supabase,
          user.id
        );

        if (merchantContext) {
          // Permission check
          const access = toUserAccess(merchantContext);
          if (!hasPermission(access, 'orders', 'fulfill')) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
          }

          // Fetch location/phone details by merchant id
          const { data: merchantDetails } = await supabase
            .from('merchants')
            .select('business_name, business_location, phone')
            .eq('id', merchantContext.merchantId)
            .single();

          if (merchantDetails) {
            // Parse business location (format: "City, State" or just "City")
            const locationParts = (merchantDetails.business_location || 'Lagos')
              .split(',')
              .map((s: string) => s.trim());
            senderInfo = {
              name:
                merchantDetails.business_name ||
                merchantContext.businessName ||
                'Merchant',
              phone: merchantDetails.phone || '',
              address: merchantDetails.business_location || 'Lagos',
              city: locationParts[0] || 'Lagos',
              state: locationParts[1] || locationParts[0] || 'Lagos',
              country: 'Nigeria',
              countryCode: 'NG',
            };
          }
        }
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
    }

    // Build quote request
    const quoteRequest: QuoteRequest = {
      sender: senderInfo,
      receiver: {
        ...data.receiver,
        phone: data.receiver.phone || '', // Default to empty string for type safety
        country: data.receiver.country || 'Nigeria',
        countryCode: data.receiver.countryCode || 'NG',
      },
      items: data.items,
      sessionId: data.sessionId || crypto.randomUUID(),
      shipmentType: data.shipmentType,
    };

    // Get quotes from all providers
    const response = await shippingService.getQuotes(quoteRequest);

    // Store quotes in database for later retrieval during booking
    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    // Store all quotes (for later reference during booking)
    // Store all quotes (for later reference during booking)
    await Promise.all(
      response.quotes.all.map((quote) =>
        supabase.from('shipping_quotes').upsert(
          {
            id: quote.id,
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

    const cookieStore = await cookies();
    const supabase = createClient(cookieStore);

    const { data: quotes, error } = await supabase
      .from('shipping_quotes')
      .select('*')
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
