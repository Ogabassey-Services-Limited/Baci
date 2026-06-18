import z from 'zod';
import type { ShippingQuote } from '@/types/shipping-quote';

interface NormalizedShippingQuoteResponse {
  quotes: ShippingQuote[];
  sessionId: string;
  warnings: string[];
}

const shippingQuoteSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough()
  .transform((quote) => quote as unknown as ShippingQuote);

type ParsedShippingQuote = z.infer<typeof shippingQuoteSchema>;

const maybeShippingQuoteSchema = z.unknown().transform((quote) => {
  const parsed = shippingQuoteSchema.safeParse(quote);
  return parsed.success ? parsed.data : undefined;
});

const shippingQuoteArraySchema = z
  .array(maybeShippingQuoteSchema)
  .transform((quotes) =>
    quotes.filter((quote): quote is ParsedShippingQuote => quote !== undefined)
  );

const shippingQuoteContainerSchema = z
  .object({
    all: shippingQuoteArraySchema.catch([]).default([]),
  })
  .passthrough();

const maybeWarningSchema = z
  .unknown()
  .transform((warning) => (typeof warning === 'string' ? warning : undefined));

const warningArraySchema = z
  .array(maybeWarningSchema)
  .transform((warnings) =>
    warnings.filter((warning): warning is string => warning !== undefined)
  );

export const shippingQuoteApiResponseSchema = z
  .object({
    quotes: z
      .union([shippingQuoteArraySchema, shippingQuoteContainerSchema])
      .catch([])
      .default([]),
    sessionId: z.string().catch('').default(''),
    warnings: warningArraySchema.catch([]).default([]),
  })
  .passthrough();

export function normalizeShippingQuoteResponsePayload(
  response: unknown
): NormalizedShippingQuoteResponse {
  const parsed = shippingQuoteApiResponseSchema.safeParse(response);

  if (!parsed.success) {
    return { quotes: [], sessionId: '', warnings: [] };
  }

  const quoteValue = parsed.data.quotes;

  return {
    quotes: Array.isArray(quoteValue) ? quoteValue : quoteValue.all,
    sessionId: parsed.data.sessionId,
    warnings: parsed.data.warnings,
  };
}
