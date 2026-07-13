import { z } from 'zod';

export const petrockAccountResponseSchema = z
  .object({
    data: z
      .object({
        balance: z.coerce.number(),
        currency: z.string().transform((value) => value.trim().toUpperCase()),
      })
      .loose(),
  })
  .loose();

const petrockPriceSchema = z.preprocess(
  (value) =>
    value === undefined || value === null || value === '' ? null : value,
  z.coerce.number().nonnegative().nullable()
);

const petrockCategoryIdsSchema = z
  .union([
    z.array(z.coerce.string()),
    z.coerce.string().transform((value) => [value]),
  ])
  .optional()
  .default([]);

export const petrockProductFieldSchema = z
  .object({
    name: z.string().min(1),
    required: z.boolean().optional(),
    type: z.string().optional(),
  })
  .loose();

export const petrockProductSchema = z
  .object({
    cid: z.coerce.string().optional(),
    cids: petrockCategoryIdsSchema,
    fields: z.array(petrockProductFieldSchema).optional().default([]),
    name: z.string().min(1),
    price: petrockPriceSchema,
    time: z.string().optional(),
    type: z.string().min(1),
  })
  .loose();

export const petrockProductsResponseSchema = z
  .object({
    data: z
      .object({
        categories: z
          .record(z.string(), z.object({ name: z.string().min(1) }).loose())
          .optional()
          .default({}),
        currency: z.string().optional().default('USD'),
        products: z.record(z.string(), petrockProductSchema),
      })
      .loose(),
  })
  .loose();

const petrockOrderIdSchema = z.coerce.string().trim().min(1);

export const petrockOrderStatusSchema = z.enum([
  'new',
  'in-process',
  'success',
  'reject',
]);

export const petrockSubmitOrderResponseSchema = z
  .object({
    data: z
      .array(
        z.array(
          z
            .object({
              order_uuid: petrockOrderIdSchema,
              reference_id: z.coerce.string().optional(),
            })
            .loose()
        )
      )
      .min(1),
  })
  .loose();

export const petrockOrderResponseSchema = z
  .object({
    data: z
      .object({
        order_uuid: petrockOrderIdSchema,
        reference_id: z.coerce.string().optional(),
        replay: z.string().optional().default(''),
        status: petrockOrderStatusSchema,
      })
      .loose(),
  })
  .loose();
