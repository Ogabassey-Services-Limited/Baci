import type { ShippingQuote } from '@/types/shipping-quote';

interface NormalizedShippingQuoteResponse {
  quotes: ShippingQuote[];
  sessionId: string;
  warnings: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeQuoteArray(value: unknown): ShippingQuote[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (quote): quote is ShippingQuote =>
      isRecord(quote) && typeof quote.id === 'string'
  );
}

function normalizeWarnings(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter(
    (warning): warning is string => typeof warning === 'string'
  );
}

export function normalizeShippingQuoteResponse(
  response: unknown
): NormalizedShippingQuoteResponse {
  if (!isRecord(response)) {
    return { quotes: [], sessionId: '', warnings: [] };
  }

  const quoteContainer = isRecord(response.quotes) ? response.quotes : null;
  const quotes = quoteContainer
    ? normalizeQuoteArray(quoteContainer.all)
    : normalizeQuoteArray(response.quotes);

  return {
    quotes,
    sessionId: typeof response.sessionId === 'string' ? response.sessionId : '',
    warnings: normalizeWarnings(response.warnings),
  };
}
