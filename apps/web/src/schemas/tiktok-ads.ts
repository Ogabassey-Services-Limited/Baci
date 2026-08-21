import { z } from 'zod';

export const MAX_TIKTOK_ADS_SYNC_DAYS = 366;
export const tiktokAdsOAuthCallbackQuerySchema = z.object({
  code: z.string().trim().min(1).optional(),
  error: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
});
const tiktokAdvertiserId = z
  .string()
  .trim()
  .min(1)
  .max(255)
  .regex(/^[^\s]+$/, 'Invalid TikTok advertiser id');
export const tiktokAdsAccountSelectionSchema = z.object({
  accountId: tiktokAdvertiserId,
});
function dateOrder(
  value: { startDate?: string; endDate?: string },
  context: z.RefinementCtx
) {
  if (value.startDate && value.endDate && value.startDate > value.endDate)
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'startDate must be on or before endDate',
      path: ['startDate'],
    });
}
export const tiktokAdsSpendQuerySchema = z
  .object({
    accountId: tiktokAdvertiserId.optional(),
    endDate: z.string().date().optional(),
    startDate: z.string().date().optional(),
  })
  .superRefine(dateOrder);
export const tiktokAdsSyncRequestSchema = z
  .object({ endDate: z.string().date(), startDate: z.string().date() })
  .superRefine((value, context) => {
    dateOrder(value, context);
    if (value.startDate > value.endDate) return;
    const days =
      Math.floor(
        (Date.parse(`${value.endDate}T00:00:00Z`) -
          Date.parse(`${value.startDate}T00:00:00Z`)) /
          86_400_000
      ) + 1;
    if (days > MAX_TIKTOK_ADS_SYNC_DAYS)
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: `Sync range cannot exceed ${MAX_TIKTOK_ADS_SYNC_DAYS} days`,
        path: ['endDate'],
      });
  });
