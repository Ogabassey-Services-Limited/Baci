/**
 * Jumia Vendor Center API — Fulfillment schemas (pack, ready-to-ship, cancel,
 * print labels)
 */

import { z } from 'zod';
import {
  FulfillmentErrorItemSchema,
  FulfillmentPackageSchema,
} from '@/schemas/jumia/shared';

/** Shared cancellation-reason shape used in cancel success/error items. */
const JumiaCancellationReason = z.object({
  id: z.string(),
  description: z.string(),
});

// ── Pack V2 ──

export const JumiaPackV2ResponseSchema = z
  .object({
    success: z
      .object({
        packages: z.array(FulfillmentPackageSchema),
        total: z.number(),
      })
      .optional(),
    error: z
      .object({
        packages: z.array(
          z.object({
            orderItems: z.string(),
            error: z.string(),
          })
        ),
        total: z.number(),
      })
      .optional(),
  })
  .refine((data) => data.success || data.error, {
    error: 'Response must contain success or error',
  });

// ── Ready to Ship ──

export const JumiaReadyToShipResponseSchema = z
  .object({
    success: z
      .object({
        packages: z.array(FulfillmentPackageSchema),
        total: z.number(),
      })
      .optional(),
    error: z
      .object({
        orderItems: z.array(FulfillmentErrorItemSchema),
        total: z.number(),
      })
      .optional(),
  })
  .refine((data) => data.success || data.error, {
    error: 'Response must contain success or error',
  });

// ── Cancel ──

export const JumiaCancelResponseSchema = z
  .object({
    success: z
      .object({
        orderItems: z.array(
          z.object({
            id: z.string(),
            cancellationReason: JumiaCancellationReason,
          })
        ),
        total: z.number(),
      })
      .optional(),
    error: z
      .object({
        orderItems: z.array(
          z.object({
            id: z.string(),
            cancellationReason: JumiaCancellationReason.optional(),
            response: z
              .object({
                code: z.string(),
                message: z.string(),
              })
              .optional(),
          })
        ),
        total: z.number(),
      })
      .optional(),
  })
  .refine((data) => data.success || data.error, {
    error: 'Response must contain success or error',
  });

// ── Print Labels ──

export const JumiaPrintLabelsResponseSchema = z
  .object({
    success: z
      .object({
        labels: z.array(
          z.object({
            orderItems: z.string(),
            trackingNumber: z.string(),
            label: z.url(),
          })
        ),
        total: z.number(),
      })
      .optional(),
    error: z
      .object({
        orderItems: z.array(FulfillmentErrorItemSchema),
        total: z.number(),
      })
      .optional(),
  })
  .refine((data) => data.success || data.error, {
    error: 'Response must contain success or error',
  });

// ── Inferred types ──

export type JumiaPackV2Response = z.infer<typeof JumiaPackV2ResponseSchema>;
export type JumiaReadyToShipResponse = z.infer<
  typeof JumiaReadyToShipResponseSchema
>;
export type JumiaCancelResponse = z.infer<typeof JumiaCancelResponseSchema>;
export type JumiaPrintLabelsResponse = z.infer<
  typeof JumiaPrintLabelsResponseSchema
>;
