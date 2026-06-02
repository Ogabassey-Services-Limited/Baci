import { z } from 'zod';

export const jumiaPriceSchema = z
  .object({
    jumiaPrice: z
      .union([z.literal(''), z.coerce.number().min(0, 'Price must be >= 0')])
      .optional(),
    jumiaSalePrice: z
      .union([
        z.literal(''),
        z.coerce.number().min(0, 'Sale price must be >= 0'),
      ])
      .optional(),
    saleStart: z.string().optional(),
    saleEnd: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (!data.saleStart && !data.saleEnd) return;

    const startMs = data.saleStart ? Date.parse(data.saleStart) : Number.NaN;
    const endMs = data.saleEnd ? Date.parse(data.saleEnd) : Number.NaN;

    if (data.saleStart && Number.isNaN(startMs)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid sale start date',
        path: ['saleStart'],
      });
      return;
    }

    if (data.saleEnd && Number.isNaN(endMs)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Invalid sale end date',
        path: ['saleEnd'],
      });
      return;
    }

    if (!Number.isNaN(startMs) && !Number.isNaN(endMs) && endMs < startMs) {
      ctx.addIssue({
        code: 'custom',
        message: 'Sale end must be on or after sale start',
        path: ['saleEnd'],
      });
    }
  });

export type JumiaPriceFormValues = z.infer<typeof jumiaPriceSchema>;
