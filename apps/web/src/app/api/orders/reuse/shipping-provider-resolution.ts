import { OrderQuoteDestinationMismatchError } from '@/lib/shipping/order-quote-destination';
import type { createClient } from '@/lib/supabase/server';
import type { ReuseCheckoutOrderInput } from '@/schemas/orders';

export function hasSelectedQuoteInput(data: ReuseCheckoutOrderInput): boolean {
  return Object.hasOwn(data, 'selected_quote_id');
}

export function normalizeShippingProvider(
  provider: string | null | undefined
): string | null {
  const normalized = provider?.trim();
  return normalized ? normalized : null;
}

function readQuoteProvider(data: unknown): string | null {
  const row = Array.isArray(data) ? data[0] : data;
  if (row === null || typeof row !== 'object' || Array.isArray(row)) {
    return null;
  }
  const provider = (row as { provider?: unknown }).provider;
  return typeof provider === 'string'
    ? normalizeShippingProvider(provider)
    : null;
}

export async function resolveSuppliedQuoteProvider(
  supabase: ReturnType<typeof createClient>,
  data: ReuseCheckoutOrderInput
): Promise<string | null> {
  if (!hasSelectedQuoteInput(data) || !data.selected_quote_id) {
    return null;
  }

  const { data: quoteData, error } = await supabase.rpc(
    'get_checkout_shipping_quote',
    {
      p_merchant_id: data.merchant_id,
      p_quote_id: data.selected_quote_id,
    }
  );
  if (error) {
    throw new OrderQuoteDestinationMismatchError(
      'Unable to validate the saved international shipping quote. Please get a new quote before checkout.',
      'INTERNATIONAL_QUOTE_LOOKUP_FAILED',
      500
    );
  }

  const quoteProvider = readQuoteProvider(quoteData);
  if (!quoteProvider) {
    throw new OrderQuoteDestinationMismatchError(
      'The saved international shipping quote no longer matches this checkout. Please get a new quote before checkout.',
      'INTERNATIONAL_QUOTE_PROVIDER_MISMATCH'
    );
  }

  return quoteProvider;
}
