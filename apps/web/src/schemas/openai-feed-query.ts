import { z } from 'zod';

export const openAIFeedQuerySchema = z
  .object({
    merchant_id: z.string().uuid().optional(),
    merchant_slug: z.string().min(1).optional(),
    format: z.enum(['jsonl', 'plain', 'current']).optional(),
  })
  .refine((data) => data.merchant_id || data.merchant_slug, {
    message: 'merchant_id or merchant_slug parameter is required',
  })
  .refine((data) => !(data.merchant_id && data.merchant_slug), {
    message: 'Provide exactly one of merchant_id or merchant_slug, not both',
  });

export type OpenAIFeedQuery = z.infer<typeof openAIFeedQuerySchema>;
