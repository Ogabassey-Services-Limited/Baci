import { z } from 'zod';
import { ADS_ANALYTICS_MAX_DAYS } from '@/lib/analytics/ads-sync-limits';

const calendarDate = z.iso.date();
const orderInstant = z.iso.datetime({ offset: true });
const MILLISECONDS_PER_DAY = 86_400_000;

/**
 * Provider spend rows use account-local calendar dates, while order
 * attribution follows the dashboard's exact selected instants. Keep both
 * boundaries explicit so the two data sources cannot silently drift.
 */
export const adsAnalyticsQuerySchema = z
  .object({
    cacheBust: z
      .string()
      .regex(/^\d{1,10}$/)
      .optional(),
    endDate: calendarDate.optional(),
    orderEnd: orderInstant.optional(),
    orderStart: orderInstant.optional(),
    startDate: calendarDate.optional(),
  })
  .superRefine((value, ctx) => {
    if (value.orderStart || value.orderEnd) {
      if (!value.orderStart || !value.orderEnd) {
        if (!value.orderStart) {
          ctx.addIssue({
            code: 'custom',
            message: 'orderStart and orderEnd must be provided together',
            path: ['orderStart'],
          });
        }
        if (!value.orderEnd) {
          ctx.addIssue({
            code: 'custom',
            message: 'orderStart and orderEnd must be provided together',
            path: ['orderEnd'],
          });
        }
      } else if (Date.parse(value.orderStart) > Date.parse(value.orderEnd)) {
        ctx.addIssue({
          code: 'custom',
          message: 'orderStart must be on or before orderEnd',
          path: ['orderStart'],
        });
      } else {
        const orderStart = Date.parse(value.orderStart);
        const orderEnd = Date.parse(value.orderEnd);
        const inclusiveOrderDays =
          Math.floor((orderEnd - orderStart) / MILLISECONDS_PER_DAY) + 1;
        if (inclusiveOrderDays > ADS_ANALYTICS_MAX_DAYS) {
          ctx.addIssue({
            code: 'custom',
            message: `Order reporting range cannot exceed ${ADS_ANALYTICS_MAX_DAYS} days`,
            path: ['orderEnd'],
          });
        }
      }
    }

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
    const inclusiveDays = Math.floor((end - start) / MILLISECONDS_PER_DAY) + 1;
    if (inclusiveDays > ADS_ANALYTICS_MAX_DAYS) {
      ctx.addIssue({
        code: 'custom',
        message: `Reporting range cannot exceed ${ADS_ANALYTICS_MAX_DAYS} days`,
        path: ['endDate'],
      });
    }
  });
