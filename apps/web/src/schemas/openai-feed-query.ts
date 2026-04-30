import { z } from 'zod';

// Keep this path unique to the missing-identifier refinement; the OpenAI feed
// route uses it to distinguish host inference from other validation failures.
export const OPENAI_FEED_MERCHANT_IDENTIFIER_PATH =
  'merchant_identifier' as const;

export const openAIFeedQuerySchema = z
  .object({
    merchant_id: z.string().uuid().optional(),
    merchant_slug: z.string().min(1).optional(),
    format: z.enum(['jsonl', 'plain', 'current']).optional(),
  })
  .refine((data) => data.merchant_id || data.merchant_slug, {
    message: 'merchant_id or merchant_slug parameter is required',
    path: [OPENAI_FEED_MERCHANT_IDENTIFIER_PATH],
  })
  .refine((data) => !(data.merchant_id && data.merchant_slug), {
    message: 'Provide exactly one of merchant_id or merchant_slug, not both',
  });

export type OpenAIFeedQuery = z.infer<typeof openAIFeedQuerySchema>;

export type OpenAIFeedQueryParseResult = ReturnType<
  typeof openAIFeedQuerySchema.safeParse
>;

export function isMissingMerchantIdentifierError(
  parsed: OpenAIFeedQueryParseResult
): boolean {
  if (parsed.success) {
    return false;
  }

  if (parsed.error.issues.length !== 1) {
    return false;
  }

  const [issue] = parsed.error.issues;
  return (
    issue.code === 'custom' &&
    issue.path.length === 1 &&
    issue.path[0] === OPENAI_FEED_MERCHANT_IDENTIFIER_PATH
  );
}
