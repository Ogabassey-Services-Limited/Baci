import { z } from 'zod';

const isoDateTime = z.string().datetime({ offset: true });

export const analyticsQuerySchema = z
  .object({
    endDate: isoDateTime.optional(),
    startDate: isoDateTime.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate && !value.endDate) {
      return;
    }

    if (!value.startDate || !value.endDate) {
      if (!value.startDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate and endDate must be provided together',
          path: ['startDate'],
        });
      }
      if (!value.endDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'startDate and endDate must be provided together',
          path: ['endDate'],
        });
      }
      return;
    }

    const startMs = Date.parse(value.startDate);
    const endMs = Date.parse(value.endDate);
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && startMs > endMs) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be before endDate',
        path: ['startDate'],
      });
    }
  });

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;
