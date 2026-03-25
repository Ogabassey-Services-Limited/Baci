/**
 * Jumia Vendor Center API — Feed schemas
 */

import { z } from 'zod';

export const JumiaFeedCreateResponseSchema = z.object({
  feedId: z.string().min(1),
});

export const JumiaFeedItemError = z.object({
  globalMessages: z.array(z.string()).optional(),
  businessClients: z
    .object({
      code: z.string(),
      messages: z.array(z.string()),
    })
    .optional(),
});

export const JumiaFeedItem = z.object({
  status: z.string().min(1),
  productSid: z.string().min(1),
  sellerSKU: z.string().min(1),
  createdAt: z.string().datetime({ offset: true }),
  updatedAt: z.string().datetime({ offset: true }),
  errorMessage: z.string().optional(),
  errors: JumiaFeedItemError.optional(),
});

export const JumiaFeedDetailsResponseSchema = z
  .object({
    feedSid: z.string().min(1),
    status: z.string().min(1),
    feedType: z.string().min(1),
    feedSource: z.string().min(1),
    total: z.number().int().nonnegative(),
    completed: z.number().int().nonnegative(),
    failed: z.number().int().nonnegative(),
    createdBy: z.object({
      sid: z.string().min(1),
      name: z.string().min(1),
      email: z.string().email(),
    }),
    reportUrl: z.string().url().nullable().optional(),
    errorMessage: z.string().optional(),
    feedItems: z.array(JumiaFeedItem),
  })
  .refine((d) => d.total >= d.completed + d.failed, {
    message: 'total must be >= completed + failed',
    path: ['total'],
  });

// ── Inferred types ──

export type JumiaFeedCreateResponse = z.infer<
  typeof JumiaFeedCreateResponseSchema
>;
export type JumiaFeedDetailsResponse = z.infer<
  typeof JumiaFeedDetailsResponseSchema
>;
