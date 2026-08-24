import { z } from 'zod';
import { ADS_SYNC_MAX_DAYS } from '@/lib/analytics/ads-sync-limits';

export const MAX_SNAPCHAT_ADS_SYNC_DAYS = ADS_SYNC_MAX_DAYS.snapchat_ads;
const accountId = z.string().trim().min(1).max(255).regex(/^\S+$/);

export const snapchatAdsOAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
});
export const snapchatAdsAccountSelectionSchema = z.object({ accountId });

function validateDateOrder(
  value: { endDate?: string; startDate?: string },
  context: z.RefinementCtx
) {
  if (value.startDate && value.endDate && value.startDate > value.endDate)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate must be on or before endDate',
      path: ['startDate'],
    });
}

export const snapchatAdsSpendQuerySchema = z
  .object({
    accountId: accountId.optional(),
    endDate: z.string().date().optional(),
    startDate: z.string().date().optional(),
  })
  .superRefine(validateDateOrder);

export const snapchatAdsSyncRequestSchema = z
  .object({ endDate: z.string().date(), startDate: z.string().date() })
  .superRefine((value, context) => {
    validateDateOrder(value, context);
    if (value.startDate > value.endDate) return;
    const days =
      Math.floor(
        (Date.parse(`${value.endDate}T00:00:00Z`) -
          Date.parse(`${value.startDate}T00:00:00Z`)) /
          86_400_000
      ) + 1;
    if (days > MAX_SNAPCHAT_ADS_SYNC_DAYS)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sync range cannot exceed ${MAX_SNAPCHAT_ADS_SYNC_DAYS} days`,
        path: ['endDate'],
      });
  });
