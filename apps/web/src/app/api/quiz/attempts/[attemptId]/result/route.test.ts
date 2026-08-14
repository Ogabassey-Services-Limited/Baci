import { NextRequest, NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { requireQuizUser } from '@/app/api/quiz/_shared/route-auth';
import { createQuizResultClaimToken } from '@/lib/quiz/quiz-result-claim';
import { GET } from './route';

vi.mock('@/app/api/quiz/_shared/route-auth', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/api/quiz/_shared/route-auth')
  >('@/app/api/quiz/_shared/route-auth');
  return { ...actual, requireQuizUser: vi.fn() };
});
vi.mock('@/lib/quiz/quiz-result-claim', () => ({
  createQuizResultClaimToken: vi.fn(),
}));
vi.mock('../answers/submit-answer-voucher', async () => {
  const actual = await vi.importActual<
    typeof import('../answers/submit-answer-voucher')
  >('../answers/submit-answer-voucher');
  return {
    ...actual,
    addSignedPrizeClaim: vi.fn((data: unknown) => {
      if (!data || typeof data !== 'object') return data;
      const row = data as { prizeClaim?: Record<string, unknown> };
      return {
        ...data,
        prizeClaim: {
          ...row.prizeClaim,
          cartPath:
            '/ogabassey/cart?item_id=44444444-4444-4444-8444-444444444444',
          voucherToken: 'signed-voucher',
        },
      };
    }),
  };
});

const ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '22222222-2222-4222-8222-222222222222';
const AVAILABLE_AT = '2026-08-05T10:05:00.000Z';

function request() {
  return new NextRequest(
    `https://shop.test/api/quiz/attempts/${ATTEMPT_ID}/result`,
    { headers: { 'X-Baci-Quiz-Contract': '2' } }
  );
}

function context(attemptId = ATTEMPT_ID) {
  return { params: Promise.resolve({ attemptId }) };
}

function authenticated(
  result: { data: unknown; error: unknown },
  award: { data: unknown; error: unknown } = { data: null, error: null }
) {
  const rpc = vi.fn((name: string) =>
    Promise.resolve(
      name === 'quiz_runtime_contract_version'
        ? { data: 2, error: null }
        : result
    )
  );
  const awardQuery = {
    eq: vi.fn(),
    maybeSingle: vi.fn().mockResolvedValue(award),
    select: vi.fn(),
  };
  awardQuery.select.mockReturnValue(awardQuery);
  awardQuery.eq.mockReturnValue(awardQuery);
  vi.mocked(requireQuizUser).mockResolvedValue({
    authMethod: 'bearer',
    response: null,
    supabase: { from: vi.fn(() => awardQuery), rpc },
    user: { id: USER_ID },
  } as never);
  return rpc;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(createQuizResultClaimToken).mockReturnValue('signed-claim');
});

describe('v2 quiz result route', () => {
  it('authenticates before params or result lookup', async () => {
    vi.mocked(requireQuizUser).mockResolvedValue({
      response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }),
    } as never);
    expect((await GET(request(), context('bad'))).status).toBe(401);
  });

  it('keeps unpublished results pending without score or claim', async () => {
    authenticated({
      data: {
        attemptId: ATTEMPT_ID,
        availability: 'pending',
        availableAt: AVAILABLE_AT,
      },
      error: null,
    });
    const response = await GET(request(), context());
    expect(await response.json()).toEqual({
      attemptId: ATTEMPT_ID,
      availability: 'pending',
      availableAt: AVAILABLE_AT,
    });
    expect(createQuizResultClaimToken).not.toHaveBeenCalled();
  });

  it('signs only bounded persisted winner metadata and strips internals', async () => {
    authenticated(
      {
        data: {
          attemptId: ATTEMPT_ID,
          availability: 'final',
          availableAt: AVAILABLE_AT,
          claimMetadata: {
            awardId: '33333333-3333-4333-8333-333333333333',
            expiresAt: '2026-08-12T10:05:00.000Z',
          },
          rank: 1,
          score: 20,
          totalQuestions: 20,
        },
        error: null,
      },
      {
        data: {
          condition: 'used',
          created_at: '2026-08-05T10:05:00.000Z',
          id: '33333333-3333-4333-8333-333333333333',
          product_id: '44444444-4444-4444-8444-444444444444',
          variant_id: null,
        },
        error: null,
      }
    );
    const response = await GET(request(), context());
    expect(await response.json()).toEqual({
      attemptId: ATTEMPT_ID,
      availability: 'final',
      availableAt: AVAILABLE_AT,
      claim: {
        expiresAt: '2026-08-12T10:05:00.000Z',
        token: 'signed-claim',
      },
      prizeClaim: {
        awardId: '33333333-3333-4333-8333-333333333333',
        cartPath:
          '/ogabassey/cart?item_id=44444444-4444-4444-8444-444444444444',
        condition: 'used',
        productId: '44444444-4444-4444-8444-444444444444',
        variantId: null,
        voucherToken: 'signed-voucher',
      },
      rank: 1,
      score: 20,
      totalQuestions: 20,
    });
    expect(createQuizResultClaimToken).toHaveBeenCalledWith({
      awardId: '33333333-3333-4333-8333-333333333333',
      expiresAt: '2026-08-12T10:05:00.000Z',
      userId: USER_ID,
    });
  });

  it('returns unavailable states and bounds RPC failures', async () => {
    authenticated({
      data: {
        attemptId: ATTEMPT_ID,
        availability: 'unavailable',
        reason: 'event_cancelled',
      },
      error: null,
    });
    expect(await (await GET(request(), context())).json()).toEqual({
      attemptId: ATTEMPT_ID,
      availability: 'unavailable',
      reason: 'event_cancelled',
    });

    authenticated({ data: null, error: { message: 'database secret' } });
    const failed = await GET(request(), context());
    expect(failed.status).toBe(500);
    expect(await failed.json()).toEqual({ error: 'Quiz request failed' });
  });
});
