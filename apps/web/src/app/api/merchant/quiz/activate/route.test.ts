import crypto from 'node:crypto';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

const mockMerchantMaybeSingle = vi.fn();
// Review lookup chain: select(settings + slots) → eq(id) → eq(merchant) → eq(status='draft') → maybeSingle
const mockReviewLookupMaybeSingle = vi.fn();
const mockReviewLookupEqThird = vi.fn(() => ({
  maybeSingle: mockReviewLookupMaybeSingle,
}));
const mockReviewLookupEqSecond = vi.fn(() => ({ eq: mockReviewLookupEqThird }));
const mockReviewLookupEqFirst = vi.fn(() => ({ eq: mockReviewLookupEqSecond }));
// Review-marker update chain: update(settings) → eq(id) → eq(merchant) → eq(status='draft') → select → maybeSingle
const mockReviewUpdateMaybeSingle = vi.fn();
const mockReviewUpdateSelect = vi.fn(() => ({
  maybeSingle: mockReviewUpdateMaybeSingle,
}));
const mockReviewUpdateEqThird = vi.fn(() => ({
  select: mockReviewUpdateSelect,
}));
const mockReviewUpdateEqSecond = vi.fn(() => ({ eq: mockReviewUpdateEqThird }));
const mockReviewUpdateEqFirst = vi.fn(() => ({ eq: mockReviewUpdateEqSecond }));
// Activation preflight chain: select(settings) → eq(id) → eq(merchant) → eq(status='draft') → maybeSingle
const mockActivationReviewMaybeSingle = vi.fn();
const mockActivationReviewEqThird = vi.fn(() => ({
  maybeSingle: mockActivationReviewMaybeSingle,
}));
const mockActivationReviewEqSecond = vi.fn(() => ({
  eq: mockActivationReviewEqThird,
}));
const mockActivationReviewEqFirst = vi.fn(() => ({
  eq: mockActivationReviewEqSecond,
}));
// Update chain: update → eq(id) → eq(merchant) → eq(status='draft') → select → maybeSingle
const mockQuizEventUpdateSingle = vi.fn();
const mockQuizEventSelect = vi.fn(() => ({
  maybeSingle: mockQuizEventUpdateSingle,
}));
const mockQuizEventEqThird = vi.fn(() => ({ select: mockQuizEventSelect }));
const mockQuizEventEqSecond = vi.fn(() => ({ eq: mockQuizEventEqThird }));
const mockQuizEventEqFirst = vi.fn(() => ({ eq: mockQuizEventEqSecond }));
const mockQuizEventUpdate = vi.fn((_payload: Record<string, unknown>) => ({
  eq: mockQuizEventEqFirst,
}));
const mockQuizEventUpdateDispatcher = vi.fn(
  (payload: Record<string, unknown>) =>
    'settings' in payload
      ? { eq: mockReviewUpdateEqFirst }
      : mockQuizEventUpdate(payload)
);
// Idempotent active-lookup chain: select → eq(id) → eq(merchant) → eq(status='active') → maybeSingle
const mockActiveLookupMaybeSingle = vi.fn();
const mockActiveEqThird = vi.fn(() => ({
  maybeSingle: mockActiveLookupMaybeSingle,
}));
const mockActiveEqSecond = vi.fn(() => ({ eq: mockActiveEqThird }));
const mockActiveEqFirst = vi.fn(() => ({ eq: mockActiveEqSecond }));
const mockQuizEventSelectDispatcher = vi.fn((columns: string) => {
  if (columns.includes('quiz_question_slots')) {
    return { eq: mockReviewLookupEqFirst };
  }
  if (columns === 'settings') {
    return { eq: mockActivationReviewEqFirst };
  }
  return { eq: mockActiveEqFirst };
});
const mockFrom = vi.fn((table: string) => {
  if (table === 'merchants') {
    return {
      select: vi.fn(() => ({
        eq: vi.fn(() => ({ maybeSingle: mockMerchantMaybeSingle })),
      })),
    };
  }
  if (table === 'quiz_events') {
    return {
      select: mockQuizEventSelectDispatcher,
      update: mockQuizEventUpdateDispatcher,
    };
  }
  return {};
});

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: (...args: unknown[]) => mockCheckCsrfProtection(...args),
}));

vi.mock('@/lib/api-auth', () => ({
  authenticateApiRequest: (...args: unknown[]) =>
    mockAuthenticateApiRequest(...args),
  getUserAccess: (...args: unknown[]) => mockGetUserAccess(...args),
  hasPermission: (...args: unknown[]) => mockHasPermission(...args),
}));

const { POST } = await import('./route');

const EVENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ANSWER_KEY_REVIEW = {
  questions: [{ correctOptionId: 'a', position: 1 }],
};

function hashAnswerKeyForTest(answer: string): string {
  return crypto
    .createHash('sha256')
    .update(answer.trim().toLowerCase())
    .digest('hex');
}

function createRequest(body: Record<string, unknown>): NextRequest {
  return new Request('http://localhost/api/merchant/quiz/activate', {
    body: JSON.stringify({
      answerKeyReview: ANSWER_KEY_REVIEW,
      confirmActivation: true,
      ...body,
    }),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  }) as unknown as NextRequest;
}

describe('POST /api/merchant/quiz/activate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckCsrfProtection.mockResolvedValue({ valid: true, response: null });
    mockAuthenticateApiRequest.mockResolvedValue({
      error: null,
      supabase: { from: mockFrom },
      user: { id: 'user-1' },
    });
    mockGetUserAccess.mockResolvedValue({
      isOwner: true,
      isStaff: false,
      merchantId: 'merchant-1',
      permissions: {},
      role: 'owner',
    });
    mockHasPermission.mockReturnValue(true);
    mockMerchantMaybeSingle.mockResolvedValue({
      data: { business_name: 'OgaBassey Gadgets', slug: 'ogabassey' },
      error: null,
    });
    mockReviewLookupMaybeSingle.mockResolvedValue({
      data: {
        settings: { time_limit_seconds: 30 },
        quiz_question_slots: [
          {
            slot_index: 1,
            quiz_question_variants: [
              {
                active: true,
                answer_key_hash: hashAnswerKeyForTest('a'),
              },
            ],
          },
        ],
      },
      error: null,
    });
    mockReviewUpdateMaybeSingle.mockResolvedValue({
      data: { id: EVENT_ID },
      error: null,
    });
    mockActivationReviewMaybeSingle.mockResolvedValue({
      data: {
        settings: {
          answer_key_reviewed: true,
          answer_key_reviewed_at: '2026-07-08T12:00:00.000Z',
        },
      },
      error: null,
    });
    mockQuizEventUpdateSingle.mockResolvedValue({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });
    // Default: no already-active event (the idempotent fallback is only reached
    // when the draft update matches no row).
    mockActiveLookupMaybeSingle.mockResolvedValue({ data: null, error: null });
  });

  it('opens a reviewed draft into an active event', async () => {
    const response = await POST(createRequest({ eventId: EVENT_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockQuizEventUpdateDispatcher).toHaveBeenCalledWith({
      settings: expect.objectContaining({
        answer_key_reviewed: true,
        answer_key_reviewed_at: expect.any(String),
        answer_key_reviewed_count: 1,
      }),
    });
    expect(mockQuizEventUpdate).toHaveBeenCalledWith({
      ends_at: null,
      starts_at: expect.any(String),
      status: 'active',
    });
    expect(mockQuizEventEqFirst).toHaveBeenCalledWith('id', EVENT_ID);
    expect(mockQuizEventEqSecond).toHaveBeenCalledWith(
      'merchant_id',
      'merchant-1'
    );
    // Only drafts can be activated.
    expect(mockQuizEventEqThird).toHaveBeenCalledWith('status', 'draft');
    expect(body.event.status).toBe('active');
  });

  it('rejects activation when the reviewed answer key does not match the stored draft', async () => {
    mockReviewLookupMaybeSingle.mockResolvedValueOnce({
      data: {
        settings: { time_limit_seconds: 30 },
        quiz_question_slots: [
          {
            slot_index: 1,
            quiz_question_variants: [
              {
                active: true,
                answer_key_hash: hashAnswerKeyForTest('b'),
              },
            ],
          },
        ],
      },
      error: null,
    });
    mockActivationReviewMaybeSingle.mockResolvedValueOnce({
      data: { settings: { time_limit_seconds: 30 } },
      error: null,
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toMatchObject({
      code: 'QUIZ_ANSWER_KEY_REVIEW_REQUIRED',
    });
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('returns 400 when the update errors', async () => {
    mockQuizEventUpdateSingle.mockResolvedValueOnce({
      data: null,
      error: { message: 'db error' },
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'QUIZ_ACTIVATION_FAILED',
    });
  });

  it('is idempotent: returns the already-active event when no draft matches', async () => {
    // Lost response / admin retry: the draft update matches no row because the
    // event is already active. Return it as success, not QUIZ_ACTIVATION_FAILED.
    mockQuizEventUpdateSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockActiveLookupMaybeSingle.mockResolvedValueOnce({
      data: {
        id: 'event-1',
        slug: 'daily-phone-quiz',
        status: 'active',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockActiveEqThird).toHaveBeenCalledWith('status', 'active');
    expect(body.event.status).toBe('active');
  });

  it('returns 400 when neither a draft nor an already-active event exists', async () => {
    mockQuizEventUpdateSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });
    mockActiveLookupMaybeSingle.mockResolvedValueOnce({
      data: null,
      error: null,
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      code: 'QUIZ_ACTIVATION_FAILED',
    });
  });

  it('returns 400 for an invalid body', async () => {
    const response = await POST(createRequest({ eventId: 'not-a-uuid' }));

    expect(response.status).toBe(400);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('requires marketing edit permission', async () => {
    mockHasPermission.mockReturnValue(false);

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(403);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('rejects requests that fail csrf validation', async () => {
    mockCheckCsrfProtection.mockResolvedValue({
      response: NextResponse.json(
        { error: 'CSRF validation failed' },
        { status: 403 }
      ),
      valid: false,
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(403);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });
});
