import { z } from 'zod';

export const crawlerCacheOutcomeSchema = z.enum([
  'hit',
  'miss',
  'stale',
  'bypass',
  'unknown',
]);

const optionalBoundedString = (max: number) =>
  z.preprocess((value) => {
    if (typeof value !== 'string') return value;
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }, z.string().max(max).optional());

export const crawlerLogPostSchema = z
  .object({
    botName: optionalBoundedString(120),
    cacheOutcome: crawlerCacheOutcomeSchema.default('unknown'),
    host: optionalBoundedString(255),
    responseTimeMs: z.coerce.number().int().min(0).max(120_000).optional(),
    statusCode: z.coerce.number().int().min(100).max(599).default(200),
    urlPath: z.string().trim().min(1).max(500),
    userAgent: optionalBoundedString(500),
  })
  .superRefine((value, ctx) => {
    if (!value.botName && !value.userAgent) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'botName or userAgent is required',
        path: ['userAgent'],
      });
    }
  });

export const crawlerLogQuerySchema = z.object({
  days: z.coerce.number().int().min(1).max(90).default(7),
  limit: z.coerce.number().int().min(1).max(1000).default(1000),
});

export type CrawlerLogPostInput = z.infer<typeof crawlerLogPostSchema>;
export type CrawlerLogQuery = z.infer<typeof crawlerLogQuerySchema>;
