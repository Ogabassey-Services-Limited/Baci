import { describe, expect, it } from '@jest/globals';
import { quizPrizeClaimSchema, quizResultSchema } from './quiz-schemas';

const completedResult = {
  attemptId: 'attempt-1',
  status: 'completed',
  correctAnswers: 2,
  totalQuestions: 3,
  prizeEligible: true,
};

const validPrizeClaim = {
  awardId: '11111111-1111-4111-8111-111111111111',
  productId: '22222222-2222-4222-8222-222222222222',
  variantId: null,
  condition: 'new',
  voucherToken: 'voucher-token-abc',
  cartPath: '/ogabassey/cart?item_id=prod-1',
};

type SafeParseResult =
  | { data: unknown; success: true }
  | {
      error: { issues: Array<{ readonly path: PropertyKey[] }> };
      success: false;
    };

function expectInvalidIssue(
  parseResult: SafeParseResult,
  path: Array<string | number>
) {
  expect(parseResult.success).toBe(false);
  if (!parseResult.success) {
    expect(parseResult.error.issues).toEqual(
      expect.arrayContaining([expect.objectContaining({ path })])
    );
  }
}

describe('quizPrizeClaimSchema', () => {
  it('accepts a winning result carrying a prize claim', () => {
    expect(
      quizResultSchema.safeParse({
        ...completedResult,
        prizeClaim: validPrizeClaim,
      }).success
    ).toBe(true);
  });

  it('trims bounded prize claim hand-off strings', () => {
    expect(
      quizPrizeClaimSchema.parse({
        ...validPrizeClaim,
        voucherToken: '  voucher-token-abc  ',
        cartPath: '  /ogabassey/cart?item_id=prod-1  ',
      })
    ).toMatchObject({
      voucherToken: 'voucher-token-abc',
      cartPath: '/ogabassey/cart?item_id=prod-1',
    });
  });

  it('rejects a prize claim missing its voucher token', () => {
    expectInvalidIssue(
      quizResultSchema.safeParse({
        ...completedResult,
        prizeClaim: {
          ...validPrizeClaim,
          voucherToken: '',
        },
      }),
      ['prizeClaim', 'voucherToken']
    );
  });

  it('keeps the mobile prize claim schema aligned with the web response shape', () => {
    const invalidClaims = [
      [{ ...validPrizeClaim, awardId: 'award-1' }, ['prizeClaim', 'awardId']],
      [
        { ...validPrizeClaim, productId: 'prod-1' },
        ['prizeClaim', 'productId'],
      ],
      [
        { ...validPrizeClaim, variantId: undefined },
        ['prizeClaim', 'variantId'],
      ],
      [
        { ...validPrizeClaim, condition: undefined },
        ['prizeClaim', 'condition'],
      ],
      [
        { ...validPrizeClaim, voucherToken: 'x'.repeat(513) },
        ['prizeClaim', 'voucherToken'],
      ],
      [
        { ...validPrizeClaim, cartPath: `/${'x'.repeat(1024)}` },
        ['prizeClaim', 'cartPath'],
      ],
    ] as const;

    for (const [prizeClaim, path] of invalidClaims) {
      expectInvalidIssue(
        quizResultSchema.safeParse({ ...completedResult, prizeClaim }),
        [...path]
      );
    }
  });
});
