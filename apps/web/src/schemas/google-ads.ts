import { z } from 'zod';
import {
  ADS_SYNC_MAX_DAYS,
  getInclusiveAdsDateRangeDays,
} from '@/lib/analytics/ads-sync-limits';

export const MAX_GOOGLE_ADS_SYNC_DAYS = ADS_SYNC_MAX_DAYS.google_ads;

export const googleAdsOAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
});

export const googleAdsAccountSelectionSchema = z.object({
  customerId: z
    .string()
    .trim()
    .regex(/^\d{3}-?\d{3}-?\d{4}$/, 'Invalid Google Ads customer id')
    .transform((value) => value.replaceAll('-', '')),
});

const customerIdSchema = z
  .string()
  .trim()
  .regex(/^\d{3}-?\d{3}-?\d{4}$/, 'Invalid Google Ads customer id')
  .transform((value) => value.replaceAll('-', ''));

export const googleAdsSpendQuerySchema = z
  .object({
    customerId: customerIdSchema.optional(),
    endDate: z.string().date().optional(),
    startDate: z.string().date().optional(),
  })
  .superRefine((value, context) => {
    if (value.startDate && value.endDate && value.startDate > value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be on or before endDate',
        path: ['startDate'],
      });
      return;
    }
    if (value.startDate && value.endDate) {
      const days = getInclusiveAdsDateRangeDays(value.startDate, value.endDate);
      if (days > MAX_GOOGLE_ADS_SYNC_DAYS) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Spend range cannot exceed ${MAX_GOOGLE_ADS_SYNC_DAYS} days`,
          path: ['endDate'],
        });
      }
    }
  });

export const googleAdsSyncRequestSchema = z
  .object({
    endDate: z.string().date(),
    finalChunk: z.boolean().default(true),
    startDate: z.string().date(),
  })
  .superRefine((value, context) => {
    if (value.startDate > value.endDate) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'startDate must be on or before endDate',
        path: ['startDate'],
      });
      return;
    }
    const days = getInclusiveAdsDateRangeDays(value.startDate, value.endDate);
    if (days > MAX_GOOGLE_ADS_SYNC_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sync range cannot exceed ${MAX_GOOGLE_ADS_SYNC_DAYS} days`,
        path: ['endDate'],
      });
    }
  });
