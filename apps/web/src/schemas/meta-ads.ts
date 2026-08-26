import { z } from 'zod';
import {
  ADS_SYNC_MAX_DAYS,
  getInclusiveAdsDateRangeDays,
} from '@/lib/analytics/ads-sync-limits';

export const MAX_META_ADS_SYNC_DAYS = ADS_SYNC_MAX_DAYS.meta_ads;

export const metaAdsOAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
});

const metaAccountId = z
  .string()
  .trim()
  .regex(/^act_\d+$/, 'Invalid Meta ad account id');

export const metaAdsAccountSelectionSchema = z.object({
  accountId: metaAccountId,
});

export const metaAdsSpendQuerySchema = z
  .object({
    accountId: metaAccountId.optional(),
    endDate: z.string().date().optional(),
    startDate: z.string().date().optional(),
  })
  .superRefine((value, context) => {
    validateDateOrder(value, context);
    if (
      value.startDate &&
      value.endDate &&
      value.startDate <= value.endDate &&
      getInclusiveAdsDateRangeDays(value.startDate, value.endDate) >
        MAX_META_ADS_SYNC_DAYS
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Spend range cannot exceed ${MAX_META_ADS_SYNC_DAYS} days`,
        path: ['endDate'],
      });
    }
  });

export const metaAdsSyncRequestSchema = z
  .object({
    endDate: z.string().date(),
    finalChunk: z.boolean().default(true),
    startDate: z.string().date(),
  })
  .superRefine((value, context) => {
    validateDateOrder(value, context);
    if (value.startDate > value.endDate) return;
    const days = getInclusiveAdsDateRangeDays(value.startDate, value.endDate);
    if (days > MAX_META_ADS_SYNC_DAYS) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sync range cannot exceed ${MAX_META_ADS_SYNC_DAYS} days`,
        path: ['endDate'],
      });
    }
  });

function validateDateOrder(
  value: { endDate?: string; startDate?: string },
  context: z.RefinementCtx
): void {
  if (value.startDate && value.endDate && value.startDate > value.endDate) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate must be on or before endDate',
      path: ['startDate'],
    });
  }
}
