import { z } from 'zod';
import { ADS_ANALYTICS_MAX_DAYS } from '@/lib/analytics/ads-sync-limits';

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
      return;
    }

    const start = Date.parse(`${value.startDate}T00:00:00Z`);
    const end = Date.parse(`${value.endDate}T00:00:00Z`);
    const inclusiveDays = Math.floor((end - start) / 86_400_000) + 1;
    if (inclusiveDays > ADS_ANALYTICS_MAX_DAYS) {
      ctx.addIssue({
        code: 'custom',
        message: `Reporting range cannot exceed ${ADS_ANALYTICS_MAX_DAYS} days`,
        path: ['endDate'],
      });
    }
  });
