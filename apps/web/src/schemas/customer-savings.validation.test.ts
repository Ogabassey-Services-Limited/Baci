import { describe, expect, it } from 'vitest';
import {
  customerSavingsAuthorizationConfirmSchema,
  customerSavingsAutoDebitAuthorizeSchema,
  customerSavingsCreateGoalSchema,
  customerSavingsGoalActionSchema,
  customerSavingsManualContributionSchema,
} from '@/schemas/customer-savings';

const VALID_MERCHANT_ID = '00000000-0000-4000-8000-000000000001';
const VALID_PRODUCT_ID = '00000000-0000-4000-8000-000000000002';
const VALID_GOAL_ID = '00000000-0000-4000-8000-000000000003';
const VALID_PAYMENT_METHOD_ID = '00000000-0000-4000-8000-000000000004';
const VALID_VARIANT_ID = '00000000-0000-4000-8000-000000000005';

function validCreateGoalPayload() {
  return {
    contributionAmount: 20_000,
    contributionFrequency: 'daily',
    initialContributionAmount: 0,
    maturityDate: '2026-07-01',
    merchantId: VALID_MERCHANT_ID,
    nonWithdrawableAccepted: true,
    productId: VALID_PRODUCT_ID,
    sourceMode: 'manual',
    startDate: '2026-06-01',
    targetAmount: 800_000,
    termsAccepted: true,
  };
}

function expectCreateGoalFailure(
  overrides: Record<string, unknown>,
  path?: string
) {
  const result = customerSavingsCreateGoalSchema.safeParse({
    ...validCreateGoalPayload(),
    ...overrides,
  });

  expect(result.success).toBe(false);
  if (!result.success && path) {
    expect(result.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path: [path] })])
    );
  }
}

describe('customer savings schema validation boundaries', () => {
  it.each([
    { contributionFrequency: 'yearly' },
    { sourceMode: 'standing_order' },
  ])('rejects unsupported goal enum values', (overrides) => {
    expectCreateGoalFailure(overrides);
  });

  it.each([
    { path: 'productId', productId: 'not-a-uuid' },
    { path: 'savedPaymentMethodId', savedPaymentMethodId: 'not-a-uuid' },
    { path: 'variantId', variantId: 'not-a-uuid' },
  ])('rejects malformed goal UUIDs for $path', ({ path, ...overrides }) => {
    expectCreateGoalFailure(overrides, path);
  });

  it('accepts optional saved payment method and variant UUIDs when valid', () => {
    const result = customerSavingsCreateGoalSchema.safeParse({
      ...validCreateGoalPayload(),
      savedPaymentMethodId: VALID_PAYMENT_METHOD_ID,
      variantId: VALID_VARIANT_ID,
    });

    expect(result.success).toBe(true);
  });

  it('validates savings authorization confirmation references', () => {
    expect(
      customerSavingsAuthorizationConfirmSchema.safeParse({
        merchantSlug: 'ogabassey',
        reference: 'SAV-AUTH-ABC123',
      }).success
    ).toBe(true);
    expect(
      customerSavingsAuthorizationConfirmSchema.safeParse({
        merchantSlug: 'ogabassey',
        reference: 'WAL-ABC123',
      }).success
    ).toBe(false);
  });

  it.each([
    { path: 'termsAccepted', termsAccepted: false },
    { path: 'nonWithdrawableAccepted', nonWithdrawableAccepted: false },
  ])('requires literal acceptance for $path', ({ path, ...overrides }) => {
    expectCreateGoalFailure(overrides, path);
  });

  it.each([
    { contributionAmount: Number.NaN, path: 'contributionAmount' },
    {
      contributionAmount: Number.POSITIVE_INFINITY,
      path: 'contributionAmount',
    },
    { contributionAmount: -1, path: 'contributionAmount' },
    {
      initialContributionAmount: Number.NaN,
      path: 'initialContributionAmount',
    },
    {
      initialContributionAmount: Number.POSITIVE_INFINITY,
      path: 'initialContributionAmount',
    },
    { initialContributionAmount: -1, path: 'initialContributionAmount' },
    { breakFeePercent: Number.NaN, path: 'breakFeePercent' },
    { breakFeePercent: Number.POSITIVE_INFINITY, path: 'breakFeePercent' },
    { breakFeePercent: -1, path: 'breakFeePercent' },
  ])('rejects invalid numeric goal value for $path', ({
    path,
    ...overrides
  }) => {
    expectCreateGoalFailure(overrides, path);
  });

  it('rejects invalid preferred debit time formats on goal creation', () => {
    expectCreateGoalFailure(
      { preferredDebitTime: '24:00' },
      'preferredDebitTime'
    );
    expectCreateGoalFailure(
      { preferredDebitTime: '06:99' },
      'preferredDebitTime'
    );
    expectCreateGoalFailure(
      { preferredDebitTime: '6:20 AM' },
      'preferredDebitTime'
    );
  });

  it.each([
    { goalId: 'not-a-uuid' },
    { goalId: VALID_GOAL_ID, merchantId: undefined, merchantSlug: undefined },
    { amount: Number.NaN, goalId: VALID_GOAL_ID },
    { amount: Number.POSITIVE_INFINITY, goalId: VALID_GOAL_ID },
    { amount: -1, goalId: VALID_GOAL_ID },
  ])('rejects invalid manual contribution payloads', (overrides) => {
    const payload = {
      amount: 20_000,
      goalId: VALID_GOAL_ID,
      idempotencyKey: 'savings-contrib-001',
      merchantId: VALID_MERCHANT_ID,
    };
    const result = customerSavingsManualContributionSchema.safeParse({
      ...payload,
      ...overrides,
    });

    expect(result.success).toBe(false);
  });

  it('requires a merchant identifier for goal actions', () => {
    const result = customerSavingsGoalActionSchema.safeParse({
      goalId: VALID_GOAL_ID,
    });

    expect(result.success).toBe(false);
  });

  it('rejects malformed goal action UUIDs', () => {
    const result = customerSavingsGoalActionSchema.safeParse({
      goalId: 'not-a-uuid',
      merchantId: VALID_MERCHANT_ID,
    });

    expect(result.success).toBe(false);
  });

  it('requires a merchant identifier for auto-debit authorization', () => {
    const result = customerSavingsAutoDebitAuthorizeSchema.safeParse({
      amount: 100,
    });

    expect(result.success).toBe(false);
  });
});
