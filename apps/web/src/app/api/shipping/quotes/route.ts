/**
 * Shipping Quotes API
 * GET aggregated shipping quotes from all providers
 *
 * Uses the admin (service-role) client instead of the cookie-based SSR client
 * because this route is called from the mobile storefront app, which sends a
 * Bearer token in the Authorization header rather than Supabase session cookies.
 * The cookie-based client always resolves to an unauthenticated session for
 * mobile requests. Mobile Bearer tokens are validated explicitly; web requests
 * use the request-bound cookie client before service-role quote storage.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { resolveMerchantCurrencyConfig } from '@/lib/resolve-merchant-currency';
import { shippingService } from '@/lib/shipping';
import { rankQuotes, selectFeaturedQuotes } from '@/lib/shipping/aggregator';
import {
  MERCHANT_PROVIDER_CODE,
  type QuoteRequest,
  type QuoteResponse,
  type ShippingQuote,
} from '@/lib/shipping/types';
import { createAdminClient } from '@/lib/supabase/admin';
import { QuoteRequestSchema } from '@/schemas/shipping';
import {
  getMerchantRateQuotes,
  type MerchantRateQuoteResult,
} from './merchant-rate-quotes';
import { resolveQuoteMerchantContext } from './quote-merchant-context';

/**
 * Build the merchant-rate-only quote response shared by BOTH non-NG paths: the
 * header/authenticated early-skip (currency/country resolved from the merchant
 * row) and the body-only suppression (currency/country revealed by the RPC).
 * Carriers are Nigerian and NGN/Lagos-origin, so a non-NG merchant only ever
 * gets its own configured rates; an empty set carries the unavailable warning.
 */
function buildMerchantOnlyQuoteResponse(
  merchantQuotes: ShippingQuote[],
  sessionId: string | undefined,
  unavailableWarning = 'Shipping rates are unavailable: carrier rates currently cover Nigerian merchants only, and this merchant has not configured its own shipping rates yet.'
): QuoteResponse {
  return {
    quotes: {
      featured: selectFeaturedQuotes(merchantQuotes),
      all: merchantQuotes,
    },
    sessionId: sessionId || crypto.randomUUID(),
    expiresAt:
      merchantQuotes[0]?.expiresAt.toISOString() ??
      new Date(Date.now() + 10 * 60 * 1000).toISOString(),
    ...(merchantQuotes.length === 0
      ? {
          warnings: [unavailableWarning],
        }
      : {}),
  } satisfies QuoteResponse;
}

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
    // Canonical merchant currency (payout_currency -> country -> NGN). Resolved
    // before quoting because it both gates the NGN-only carriers below AND
    // filters stale-currency merchant rates inside getMerchantRateQuotes.
    const merchantCountry =
      merchantContext.merchantCountry?.trim().toUpperCase() || undefined;
    const merchantCurrency = resolveMerchantCurrencyConfig({
      country: merchantCountry,
      payout_currency: merchantContext.merchantPayoutCurrency,
    }).code;

    // Merchant-configured rates are LOADED for EVERY resolved merchant — not
    // just opted-in callers — because the SECURITY DEFINER RPC is the ONLY
    // currency-discovery path for a body-only request (root-domain slug
    // checkout posts just a body merchantId with no trusted merchant header, so
    // the route defaulted `merchantCurrency` to NGN and cannot read the
    // merchants table for an arbitrary id). The resolved currency/country it
    // returns feeds the NGN-only carrier gate below, so a non-NG body-only
    // merchant is detected even before a client chooses to display its rates.
    // Whether the resulting QUOTES are EXPOSED is a separate decision
    // (`includeMerchantRateQuotes`): a merchant rate carries a synthetic
    // mrate_<uuid> id the caller must be able to thread back into order
    // creation as shipping_rate_id. Modern web and mobile checkout opt in;
    // older clients can leave the flag false and still receive the correct
    // carrier suppression without an order-unusable rate. Never rejects
    // (fails soft to []) so a bad merchant-rate configuration cannot take down
    // checkout.
    const includeMerchantRateQuotes = data.supports_merchant_rates === true;
    const merchantQuotesPromise = merchantContext.merchantId
      ? getMerchantRateQuotes(supabase, {
          merchantId: merchantContext.merchantId,
          receiverCountryCode: data.receiver.countryCode,
          receiverState: data.receiver.state,
          merchantCurrency,
          cartSubtotal: data.cart_subtotal,
        })
      : Promise.resolve<MerchantRateQuoteResult>({
          quotes: [],
          enabledCarrierProviderCodes: [],
        });

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

    const merchantRateResult = await merchantQuotesPromise;
    const {
      quotes: merchantQuotes,
      resolvedCurrency,
      resolvedCountry,
      loadFailed,
    } = merchantRateResult;

    // An empty provider list is a successful explicit merchant opt-out. A
    // failed merchant-rate load, however, leaves provider opt-ins unknown, so
    // carrier quotes must fail closed before the aggregator is called.
    const shouldSuppressCarrierRates =
      loadFailed ||
      merchantCurrency !== 'NGN' ||
      (merchantCountry !== undefined && merchantCountry !== 'NG') ||
      (resolvedCurrency !== undefined && resolvedCurrency !== 'NGN') ||
      (resolvedCountry !== undefined && resolvedCountry !== 'NG');

    if (shouldSuppressCarrierRates) {
      return NextResponse.json(
        buildMerchantOnlyQuoteResponse(
          includeMerchantRateQuotes ? merchantQuotes : [],
          data.sessionId,
          loadFailed
            ? 'Shipping rates are temporarily unavailable. Please try again.'
            : undefined
        )
      );
    }

    // Build quote request
    const quoteRequest: QuoteRequest = {
      merchantId: merchantContext.merchantId,
      ...(merchantContext.merchantId
        ? {
            enabledProviderCodes:
              merchantRateResult.enabledCarrierProviderCodes,
          }
        : {}),
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

    // Carrier selection is merchant-scoped. Merchant rates were loaded above so
    // their carrier settings can constrain the provider registry before any
    // live carrier request is made.
    const carrierResponse = await shippingService.getQuotes(quoteRequest);

    // Merge merchant rates with carrier quotes, then RE-RANK the whole list
    // with the same scoring the aggregator applies to carrier quotes so a
    // cheaper merchant rate can sort ahead of a pricier carrier (checkout
    // auto-selects the first door quote). `featured` is re-bucketed over the
    // same merged list. Skipped when empty so carrier-only responses stay
    // byte-identical.
    let response = carrierResponse;
    // Only opted-in callers receive the (unbookable-for-them) mrate_ quotes;
    // for everyone else this is [] and the carrier-only response is
    // byte-identical to the pre-merchant-rate path.
    const exposedMerchantQuotes = includeMerchantRateQuotes
      ? merchantQuotes
      : [];
    if (exposedMerchantQuotes.length > 0) {
      const mergedQuotes = [
        ...carrierResponse.quotes.all,
        ...exposedMerchantQuotes,
      ];
      response = {
        ...carrierResponse,
        quotes: {
          featured: selectFeaturedQuotes(mergedQuotes),
          all: rankQuotes(mergedQuotes),
        },
      };
    }

    // Store carrier quotes for later booking. Merchant-rate quotes are NEVER
    // persisted: shipping_quotes' provider CHECK constraint rejects 'MERCHANT'
    // and the order route recomputes merchant fees from rate config instead.
    await Promise.all(
      response.quotes.all
        .filter((quote) => quote.provider !== MERCHANT_PROVIDER_CODE)
        .map((quote) =>
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
