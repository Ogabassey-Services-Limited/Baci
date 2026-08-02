import type { SupabaseClient } from '@supabase/supabase-js';
import { parseStorefrontShippingRatesPayload } from '@/schemas/merchant-shipping-rates';
import type { StorefrontShippingRatesPayload } from './types';

const STOREFRONT_SHIPPING_RATES_RPC = 'get_storefront_shipping_rates';

/**
 * Thrown by {@link getMerchantShippingRatesOrThrow} when the storefront RPC
 * itself fails (RPC / DB / schema-cache error). The order-verification path
 * uses this to tell a transient LOAD FAILURE apart from a genuinely-empty rate
 * set: a failure must surface as a 500 server error, never as a
 * customer-correctable 400 invalid-rate. The quote path keeps using the
 * fail-soft {@link getMerchantShippingRates}.
 */
export class MerchantShippingRatesLoadError extends Error {
  /** The Postgres / PostgREST error code, when the RPC error carried one. */
  readonly code?: string;

  constructor(message: string, options?: { cause?: unknown; code?: string }) {
    super(
      message,
      options?.cause === undefined ? undefined : { cause: options.cause }
    );
    this.name = 'MerchantShippingRatesLoadError';
    this.code = options?.code;
  }
}

function extractErrorCode(error: unknown): string | undefined {
  if (error && typeof error === 'object' && 'code' in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' ? code : undefined;
  }
  return undefined;
}

/**
 * Load a merchant's active shipping zones/locations/rates through the
 * SECURITY DEFINER storefront RPC (the only anon-safe read path — the tables
 * themselves have no anon grants). Works with any Supabase client: the anon
 * checkout client for quoting and the service-role client for server-side
 * fee re-verification on order creation.
 *
 * Fails soft: RPC errors or malformed payloads resolve to empty zones/rates
 * so shipping quoting never takes down a checkout. Use
 * {@link getMerchantShippingRatesOrThrow} on the order path, where a load
 * failure must NOT masquerade as an empty rate set.
 */
export async function getMerchantShippingRates(
  supabase: SupabaseClient,
  merchantId: string
): Promise<StorefrontShippingRatesPayload> {
  const { data, error } = await supabase.rpc(STOREFRONT_SHIPPING_RATES_RPC, {
    p_merchant_id: merchantId,
  });

  if (error) {
    console.error('Failed to load merchant shipping rates', {
      merchantId,
      error,
    });
    return { zones: [], locations: [], rates: [], shippingProviders: [] };
  }

  return parseStorefrontShippingRatesPayload(data);
}

/**
 * Fail-LOUD variant for the order-verification path: throws a
 * {@link MerchantShippingRatesLoadError} when the storefront RPC errors,
 * instead of collapsing the failure into an empty payload. A successful RPC
 * (even one that returns no rates) resolves to the parsed payload exactly like
 * {@link getMerchantShippingRates}, so a genuinely-empty result stays a normal
 * (non-throwing) outcome the verifier can reject as an invalid rate (400).
 */
export async function getMerchantShippingRatesOrThrow(
  supabase: SupabaseClient,
  merchantId: string
): Promise<StorefrontShippingRatesPayload> {
  const { data, error } = await supabase.rpc(STOREFRONT_SHIPPING_RATES_RPC, {
    p_merchant_id: merchantId,
  });

  if (error) {
    throw new MerchantShippingRatesLoadError(
      'Failed to load merchant shipping rates',
      { cause: error, code: extractErrorCode(error) }
    );
  }

  return parseStorefrontShippingRatesPayload(data);
}
