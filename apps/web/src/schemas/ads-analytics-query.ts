import { z } from 'zod';

const calendarDate = z.iso.date();

/**
 * The Ads dashboard uses date-only windows. Spend rows are keyed by each ad
 * account's local calendar date, so accepting instants here would reintroduce
 * UTC day shifts at the API boundary.
 */
export const adsAnalyticsQuerySchema = z
  .object({
    cacheBust: z
      .string()
      .regex(/^\d{1,10}$/)
      .optional(),
    endDate: calendarDate.optional(),
    startDate: calendarDate.optional(),
  })
  .superRefine((value, ctx) => {
    if (!value.startDate && !value.endDate) return;

    if (!value.startDate || !value.endDate) {
      if (!value.startDate) {
        ctx.addIssue({
          code: 'custom',
          message: 'startDate and endDate must be provided together',
          path: ['startDate'],
        });
      }
      if (!value.endDate) {
        ctx.addIssue({
          code: 'custom',
          message: 'startDate and endDate must be provided together',
          path: ['endDate'],
        });
      }
      return;
    }

    if (value.startDate > value.endDate) {
      ctx.addIssue({
        code: 'custom',
        message: 'startDate must be on or before endDate',
        path: ['startDate'],
      });
    }
  });
