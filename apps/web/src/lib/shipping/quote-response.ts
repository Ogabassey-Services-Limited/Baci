import { normalizeShippingQuoteResponsePayload } from '@/schemas/shipping-quote-response';
import type { ShippingQuote } from '@/types/shipping-quote';

interface NormalizedShippingQuoteResponse {
  quotes: ShippingQuote[];
  sessionId: string;
  warnings: string[];
}

export function normalizeShippingQuoteResponse(
  response: unknown
): NormalizedShippingQuoteResponse {
  return normalizeShippingQuoteResponsePayload(response);
}
