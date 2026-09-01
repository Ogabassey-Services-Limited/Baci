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
import { postAdminOrderGiglQuote } from './admin-order-gigl-quote';
import {
  getMerchantRateQuotes,
  type MerchantRateQuoteResult,
} from './merchant-rate-quotes';
import { toPublicQuoteResponse } from './public-quote-response';
import { resolveQuoteMerchantContext } from './quote-merchant-context';
import { resolveQuoteSender } from './resolve-quote-sender';
import { toShippingQuoteUpsert } from './shipping-quote-persistence';

/**
 * Build the merchant-rate-only quote response shared by BOTH non-NG paths: the
 * header/authenticated early-skip (currency/country resolved from the merchant
 * row) and the body-only suppression (currency/country revealed by the RPC).
 * Carriers are Nigerian and NGN/Lagos-origin, so a non-NG merchant only ever
 * gets its own configured rates; an empty set carries the unavailable warning.
 */
function buildMerchantOnlyQuoteResponse(
  merchantQuotes: ShippingQuote[],
  sessionId: string | undefined
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
          warnings: [
            'Shipping rates are unavailable: carrier rates currently cover Nigerian merchants only, and this merchant has not configured its own shipping rates yet.',
          ],
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
    if (request.headers.get('x-baci-admin-order-mode') === '1') {
      return await postAdminOrderGiglQuote(request);
    }
    const body = await request.json();

    if (
      body &&
      typeof body === 'object' &&
      typeof body.admin_order_id === 'string'
    ) {
      return NextResponse.json(
        { error: 'Admin order mode header required' },
        { status: 400 }
      );
    }

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
    const merchantCountry = merchantContext.merchantCountry
      ?.trim()
      .toUpperCase();
    const merchantCurrency = resolveMerchantCurrencyConfig({
      country: merchantCountry,
      payout_currency: merchantContext.merchantPayoutCurrency,
    }).code;

    // Did the route resolve the merchant's currency/country from TRUSTED context
    // (a storefront header or an authenticated session) rather than DEFAULTING to
    // NGN for a body-only request? Only trusted context populates these fields
    // (see resolveQuoteMerchantContext); a body-only request leaves both null.
    // The body-only fail-closed guard below is gated on this so the
    // header/authenticated carrier decision — already made from trusted context —
    // is never touched.
    const hasTrustedMerchantCurrencyContext =
      merchantContext.merchantCountry != null ||
      merchantContext.merchantPayoutCurrency != null;

    // Merchant-configured rates are LOADED for EVERY resolved merchant — not
    // just opted-in callers — because the SECURITY DEFINER RPC is the ONLY
    // currency-discovery path for a body-only request (root-domain slug
    // checkout posts just a body merchantId with no trusted merchant header, so
    // the route defaulted `merchantCurrency` to NGN and cannot read the
    // merchants table for an arbitrary id). The resolved currency/country it
    // returns feeds the NGN-only carrier gate below, so a non-NG body-only
    // merchant is detected even when the client cannot handle merchant rates.
    // Whether the resulting QUOTES are EXPOSED is a separate decision
    // (`includeMerchantRateQuotes`): a merchant rate carries a synthetic
    // `mrate_<uuid>` id the caller must be able to thread back into order
    // creation as `shipping_rate_id`, and clients that cannot (e.g. the mobile
    // storefront, which auto-selects the cheapest `quotes.all` entry and
    // validates a UUID `selected_quote_id`) leave the flag false — they still
    // get correct carrier SUPPRESSION for a non-NG merchant, but never the
    // unbookable mrate_ quotes themselves. Never rejects (fails soft to []) so
    // it runs concurrently with carriers.
    const includeMerchantRateQuotes = data.supports_merchant_rates === true;
    const merchantQuotesPromise = merchantContext.merchantId
      ? getMerchantRateQuotes(supabase, {
          merchantId: merchantContext.merchantId,
          receiverCountryCode: data.receiver.countryCode,
          receiverState: data.receiver.state,
          merchantCurrency,
          cartSubtotal: data.cart_subtotal,
        })
      : Promise.resolve<MerchantRateQuoteResult>({ quotes: [] });

    // Every registered carrier (Topship/GIGL) is Nigerian and quotes are
    // NGN-denominated with a Nigeria origin. Both a merchant whose canonical
    // currency (payout_currency -> country -> NGN) is not NGN and a merchant
    // whose country is not Nigeria must not receive these quotes: the rates
    // would be wrong in origin and/or currency. Carriers are skipped for them
    // and merchant-configured rates become the only quote source.
    if (
      merchantCurrency !== 'NGN' ||
      (merchantCountry && merchantCountry !== 'NG')
    ) {
      // Merchant-rate quotes are never persisted and all share one synthetic
      // 24h engine expiry; the warning is reserved for the truly-empty case.
      // Incapable clients still get the non-NG carrier suppression, but the
      // unbookable mrate_ quotes are dropped ([]) so only opted-in callers see
      // them.
      const { quotes: merchantQuotes } = await merchantQuotesPromise;
      return NextResponse.json(
        buildMerchantOnlyQuoteResponse(
          includeMerchantRateQuotes ? merchantQuotes : [],
          data.sessionId
        )
      );
    }

    const senderResult = resolveQuoteSender({
      merchantId: merchantContext.merchantId,
      sender: merchantContext.senderInfo,
      shipmentType: data.shipmentType,
    });
    if (!senderResult.ok) {
      return NextResponse.json(
        { error: senderResult.error },
        { status: senderResult.status }
      );
    }

    // Build quote request
    const quoteRequest: QuoteRequest = {
      merchantId: merchantContext.merchantId,
      sender: senderResult.sender,
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

    // Get quotes from all providers (merchant rates computed concurrently)
    const [carrierResponse, merchantRateResult] = await Promise.all([
      shippingService.getQuotes(quoteRequest),
      merchantQuotesPromise,
    ]);
    const {
      quotes: merchantQuotes,
      resolvedCurrency,
      resolvedCountry,
      loadFailed,
    } = merchantRateResult;

    // Body-only fail-closed on a rate-RPC LOAD FAILURE. The non-NG guard below
    // reads `resolvedCurrency`/`resolvedCountry` from the SECURITY DEFINER RPC to
    // detect a non-NG merchant the route defaulted to NGN. When that RPC errors,
    // getMerchantRateQuotes surfaces `loadFailed` with BOTH resolved fields
    // undefined, so the guard cannot see the merchant is non-NG and would MERGE
    // the NGN/Lagos carrier quotes fetched above — a fee /api/orders could then
    // charge as the merchant's own (now-unknown) currency. On the body-only path
    // (no trusted storefront header / auth, so the currency defaulted to NGN)
    // fail closed: drop carriers and return the merchant-only response (empty +
    // the unavailable warning). A genuine NG merchant that hits a transient RPC
    // error on this path gets no carrier quotes — the deliberate safe tradeoff,
    // since no quotes beats a wrong-currency charge. The header/authenticated
    // path resolved currency from trusted context, so it is gated out here and
    // its carrier decision stays byte-identical.
    if (loadFailed && !hasTrustedMerchantCurrencyContext) {
      // `merchantQuotes` is already [] on a load failure; gate it anyway so the
      // exposure rule is uniform across every merchant-only return.
      return NextResponse.json(
        buildMerchantOnlyQuoteResponse(
          includeMerchantRateQuotes ? merchantQuotes : [],
          data.sessionId
        )
      );
    }

    // Body-only non-NG guard. This branch is reached only when the route
    // resolved NGN/NG — a body-only quote request (root-domain slug checkout
    // posts just a body merchantId, and reading the merchants table for an
    // arbitrary id is the anti-enumeration boundary) has no trusted merchant
    // header, so `merchantCurrency` defaulted to NGN. The SECURITY DEFINER
    // merchant-rate RPC just revealed the merchant is actually non-NG, so the
    // NGN-denominated, Lagos-origin carrier quotes fetched above must NOT be
    // merged into this checkout: a shopper selecting one would have that numeric
    // fee charged as the merchant's own currency by /api/orders. Drop the
    // carriers (the fetch is wasted, but correctness wins) and return
    // merchant-rate only, matching the header-resolved non-NG early-skip above.
    // When the RPC revealed nothing new (currency columns absent -> both
    // undefined, or a genuine NGN/NG merchant), this is a no-op and the NG merge
    // path below stays byte-identical.
    if (
      (resolvedCurrency && resolvedCurrency !== 'NGN') ||
      (resolvedCountry && resolvedCountry !== 'NG')
    ) {
      return NextResponse.json(
        buildMerchantOnlyQuoteResponse(
          includeMerchantRateQuotes ? merchantQuotes : [],
          data.sessionId
        )
      );
    }

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
    const persistenceResults = await Promise.all(
      response.quotes.all
        .filter((quote) => quote.provider !== MERCHANT_PROVIDER_CODE)
        .map((quote) =>
          supabase.from('shipping_quotes').upsert(
            toShippingQuoteUpsert(quote, {
              merchantId: quoteRequest.merchantId,
              sessionId: response.sessionId,
              quoteRequest,
            }),
            { onConflict: 'id' }
          )
        )
    );
    const persistenceFailure = persistenceResults.find(
      (result) => result.error
    );
    if (persistenceFailure?.error) {
      console.error('Error persisting shipping quote', {
        code: persistenceFailure.error.code,
        message: persistenceFailure.error.message,
      });
      return NextResponse.json(
        { error: 'Failed to get shipping quotes' },
        { status: 500 }
      );
    }

    return NextResponse.json(toPublicQuoteResponse(response));
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
