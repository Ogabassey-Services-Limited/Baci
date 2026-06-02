import { z } from 'zod';

export const trackOrderTokenSchema = z.object({
  token: z.string().min(1),
  merchant_slug: z
    .string()
    .min(1)
    .regex(/^[a-z0-9-]+$/i),
});

export const trackOrderEmailSchema = z
  .object({
    order_number: z.string().optional(),
    order_id: z.uuid().optional(),
    email: z.email(),
    merchant_slug: z
      .string()
      .min(1)
      .regex(/^[a-z0-9-]+$/i),
  })
  .refine((data) => data.order_number || data.order_id, {
    error: 'order_number or order_id is required',
  });

export type TrackOrderTokenInput = z.infer<typeof trackOrderTokenSchema>;
export type TrackOrderEmailInput = z.infer<typeof trackOrderEmailSchema>;
