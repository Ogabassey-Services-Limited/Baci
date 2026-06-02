import { z } from 'zod';

export function preprocessTrimToUndefined(value: unknown) {
  if (typeof value !== 'string') {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export const optionalNonEmptyString = z.preprocess(
  preprocessTrimToUndefined,
  z.string().min(1).optional()
);

export const optionalMerchantId = z.preprocess(
  preprocessTrimToUndefined,
  z.uuid('Merchant id must be a valid UUID').optional()
);

export const optionalUuid = z.preprocess(
  preprocessTrimToUndefined,
  z.uuid('Must be a valid UUID').optional()
);

function makeMerchantIdentifierRefinement(message: string) {
  return (
    data: { merchantId?: string; merchantSlug?: string },
    ctx: z.RefinementCtx
  ) => {
    if (!data.merchantId && !data.merchantSlug) {
      ctx.addIssue({
        code: 'custom',
        message,
        path: ['merchantSlug'],
      });
    }
  };
}

export const requireMerchantIdentifier = makeMerchantIdentifierRefinement(
  'Merchant slug or id is required'
);

export const requireWalletFundingMerchantIdentifier =
  makeMerchantIdentifierRefinement('merchantSlug or merchantId is required');
