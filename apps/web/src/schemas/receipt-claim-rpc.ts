import { z } from 'zod';
import { toSafeInternalRedirectPath } from '@/lib/safe-internal-redirect-path';

const internalRedirectPathSchema = z
  .string()
  .refine(
    (value) => toSafeInternalRedirectPath(value) === value,
    'Invalid redirect path'
  );

const receiptClaimOrderItemSchema = z.object({
  name: z.string().nullable(),
  quantity: z.number().nullable(),
});

const receiptClaimOrderSchema = z.object({
  id: z.string(),
  order_items: z.array(receiptClaimOrderItemSchema).nullable().optional(),
  order_number: z.string(),
});

const receiptClaimMerchantSchema = z.object({
  business_name: z.string().nullable(),
  slug: z.string().nullable(),
});

const nonNegativeIntegerSchema = z.number().int().nonnegative();
const nullableIsoDateTimeSchema = z.iso.datetime({ offset: true }).nullable();
const receiptClaimChannelSourceSchema = z
  .enum(['web', 'app', 'unknown'])
  .nullable();
const receiptClaimAppDownloadSourceSchema = z
  .enum(['app_store', 'play_store', 'unknown'])
  .nullable();

const receiptClaimCampaignRecipientBaseSchema = z.object({
  appDownloadClickCount: nonNegativeIntegerSchema,
  claimedAt: nullableIsoDateTimeSchema,
  claimedSource: receiptClaimChannelSourceSchema,
  clickCount: nonNegativeIntegerSchema,
  customerEmail: z.string(),
  customerName: z.string().nullable(),
  firstAppDownloadClickedAt: nullableIsoDateTimeSchema,
  firstAppDownloadSource: receiptClaimAppDownloadSourceSchema,
  firstClickedAt: nullableIsoDateTimeSchema,
  firstClickSource: receiptClaimChannelSourceSchema,
  firstLoginStartedAt: nullableIsoDateTimeSchema,
  firstLoginStartedSource: receiptClaimChannelSourceSchema,
  id: z.string(),
  lastAppDownloadClickedAt: nullableIsoDateTimeSchema,
  lastAppDownloadSource: receiptClaimAppDownloadSourceSchema,
  lastClickedAt: nullableIsoDateTimeSchema,
  lastClickSource: receiptClaimChannelSourceSchema,
  lastLoginStartedAt: nullableIsoDateTimeSchema,
  lastLoginStartedSource: receiptClaimChannelSourceSchema,
  loginStartedCount: nonNegativeIntegerSchema,
  notificationSentAt: nullableIsoDateTimeSchema,
});

const receiptClaimCampaignRecipientSchema =
  receiptClaimCampaignRecipientBaseSchema.superRefine((recipient, context) => {
    const pairedFields = [
      ['claimedAt', 'claimedSource'],
      ['firstClickedAt', 'firstClickSource'],
      ['lastClickedAt', 'lastClickSource'],
      ['firstLoginStartedAt', 'firstLoginStartedSource'],
      ['lastLoginStartedAt', 'lastLoginStartedSource'],
      ['firstAppDownloadClickedAt', 'firstAppDownloadSource'],
      ['lastAppDownloadClickedAt', 'lastAppDownloadSource'],
    ] as const;

    for (const [timestampField, sourceField] of pairedFields) {
      const hasTimestamp = recipient[timestampField] !== null;
      const hasSource = recipient[sourceField] !== null;

      if (hasTimestamp === hasSource) {
        continue;
      }

      context.addIssue({
        code: 'custom',
        message: `${timestampField} and ${sourceField} must be returned together`,
        path: [hasTimestamp ? sourceField : timestampField],
      });
    }
  });

export const receiptClaimRecordSchema = z.object({
  claimed_at: z.string().nullable(),
  claimed_by_user_id: z.string().nullable(),
  customer_email: z.string(),
  customer_id: z.string(),
  customer_name: z.string().nullable(),
  expires_at: z.string(),
  id: z.string(),
  merchant_id: z.string(),
  merchant: receiptClaimMerchantSchema.nullable().optional(),
  orders: z.array(receiptClaimOrderSchema).nullable().optional(),
});

export const redeemReceiptClaimResultSchema = z.object({
  redirectPath: internalRedirectPathSchema.optional(),
  status: z.enum([
    'already_used',
    'customer_link_failed',
    'email_mismatch',
    'expired',
    'not_found',
    'ok',
    'unauthorized',
  ]),
});

export const createReceiptClaimResultSchema = z.object({
  claim_id: z.string().nullable().optional(),
  status: z.enum(['created', 'skipped']),
});

export const receiptClaimCampaignStatsSchema = z.object({
  appDownloadClickCount: nonNegativeIntegerSchema,
  appDownloadClickedCount: nonNegativeIntegerSchema,
  claimedAppCount: nonNegativeIntegerSchema,
  claimedCount: nonNegativeIntegerSchema,
  claimedWebCount: nonNegativeIntegerSchema,
  clickedAppCount: nonNegativeIntegerSchema,
  clickedCount: nonNegativeIntegerSchema,
  clickedWebCount: nonNegativeIntegerSchema,
  lastActivityAt: nullableIsoDateTimeSchema,
  loginStartedAppCount: nonNegativeIntegerSchema,
  loginStartedCount: nonNegativeIntegerSchema,
  loginStartedWebCount: nonNegativeIntegerSchema,
  recipients: z.array(receiptClaimCampaignRecipientSchema),
  sentCount: nonNegativeIntegerSchema,
  totalRecipients: nonNegativeIntegerSchema,
});

export type ReceiptClaimRecord = z.infer<typeof receiptClaimRecordSchema>;
export type CreateReceiptClaimResult = z.infer<
  typeof createReceiptClaimResultSchema
>;
export type RedeemReceiptClaimResult = z.infer<
  typeof redeemReceiptClaimResultSchema
>;
export type ReceiptClaimCampaignStats = z.infer<
  typeof receiptClaimCampaignStatsSchema
>;
