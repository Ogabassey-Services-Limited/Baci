import { NextResponse } from 'next/server';
import { createQuizVoucherToken } from '@/lib/quiz-voucher-token';

export type PrizeCondition = 'new' | 'used' | 'open_box' | 'refurbished' | null;

export type RawPrizeClaim = {
  awardId: string;
  condition: PrizeCondition;
  productId: string;
  variantId: string | null;
};

export function normalizePrizeCondition(value: unknown): PrizeCondition {
  return value === 'new' ||
    value === 'used' ||
    value === 'open_box' ||
    value === 'refurbished'
    ? value
    : null;
}

export function getRawPrizeClaim(data: unknown): RawPrizeClaim | null {
  if (!data || typeof data !== 'object') return null;
  const claim = (data as { prizeClaim?: unknown }).prizeClaim;
  if (!claim || typeof claim !== 'object') return null;

  const {
    awardId,
    condition = null,
    productId,
    variantId = null,
  } = claim as Partial<RawPrizeClaim>;
  if (typeof awardId !== 'string' || typeof productId !== 'string') {
    return null;
  }

  return {
    awardId,
    condition: normalizePrizeCondition(condition),
    productId,
    variantId: typeof variantId === 'string' ? variantId : null,
  };
}

export function voucherTokenConfigResponse() {
  return NextResponse.json(
    {
      code: 'QUIZ_VOUCHER_TOKEN_CONFIG_MISSING',
      error: 'Quiz voucher signing is not configured',
    },
    { status: 500 }
  );
}

export const QUIZ_VOUCHER_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export function addSignedPrizeClaim(
  data: unknown,
  userId: string,
  // Replay-recovery passes the ORIGINAL expiry (award mint time + TTL) so a
  // late retry does not extend the redemption window past the first win. The
  // first-success path omits it and gets a fresh TTL.
  expiresAtOverride?: string
): unknown {
  const prizeClaim = getRawPrizeClaim(data);
  if (!prizeClaim || !data || typeof data !== 'object') return data;

  const expiresAt =
    expiresAtOverride ??
    new Date(Date.now() + QUIZ_VOUCHER_TTL_MS).toISOString();
  const voucherToken = createQuizVoucherToken({
    payload: {
      awardId: prizeClaim.awardId,
      condition: prizeClaim.condition,
      expiresAt,
      productId: prizeClaim.productId,
      userId,
      variantId: prizeClaim.variantId,
    },
  });
  const searchParams = new URLSearchParams({
    item_id: prizeClaim.productId,
    quiz_award_id: prizeClaim.awardId,
    quiz_voucher_token: voucherToken,
  });
  if (prizeClaim.variantId) {
    searchParams.set('variant_id', prizeClaim.variantId);
  }
  if (prizeClaim.condition) {
    searchParams.set('condition', prizeClaim.condition);
  }

  return {
    ...(data as Record<string, unknown>),
    prizeClaim: {
      ...prizeClaim,
      cartPath: `/ogabassey/cart?${searchParams.toString()}`,
      voucherToken,
    },
  };
}
