import crypto from 'node:crypto';
import {
  QUIZ_LIVE_RULES_VERSION,
  QUIZ_TEST_RULES_VERSION,
} from '@baci/shared/constants';
import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockCheckCsrfProtection = vi.fn();
const mockAuthenticateApiRequest = vi.fn();
const mockGetUserAccess = vi.fn();
const mockHasPermission = vi.fn();

const mockMerchantMaybeSingle = vi.fn();
// The answer-key review comparison + settings write now live in a SECURITY
// DEFINER RPC (authenticated users can't read answer_key_hash), so the route
// calls supabase.rpc('record_merchant_quiz_answer_key_review', …).
const mockRpc = vi.fn();
// activateMerchantQuizDraft's review preflight: select('settings') → eq(id) →
// eq(merchant) → eq(status='draft') → maybeSingle. Returns null (no activation)
// unless the draft carries a persisted answer_key_reviewed marker.
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
// Activation update chain: update → eq(id) → eq(merchant) → eq(status='draft') → select → maybeSingle
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
// Idempotent active-lookup chain: select → eq(id) → eq(merchant) → eq(status='active') → maybeSingle
const mockActiveLookupMaybeSingle = vi.fn();
const mockActiveStatusIn = vi.fn(() => ({
  maybeSingle: mockActiveLookupMaybeSingle,
}));
const mockActiveEqThird = vi.fn(() => ({
  in: mockActiveStatusIn,
  maybeSingle: mockActiveLookupMaybeSingle,
}));
const mockActiveEqSecond = vi.fn(() => ({ eq: mockActiveEqThird }));
const mockActiveEqFirst = vi.fn(() => ({ eq: mockActiveEqSecond }));
const mockQuizEventSelectDispatcher = vi.fn((columns: string) => {
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
      update: mockQuizEventUpdate,
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
      supabase: { from: mockFrom, rpc: mockRpc },
      user: { id: 'user-1' },
    });
    // Default: the review RPC records the review successfully.
    mockRpc.mockResolvedValue({ data: true, error: null });
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
    // The review is recorded through the SECURITY DEFINER RPC (only hashes sent).
    expect(mockRpc).toHaveBeenCalledWith(
      'record_merchant_quiz_answer_key_review',
      expect.objectContaining({
        p_event_id: EVENT_ID,
        p_merchant_id: 'merchant-1',
        p_reviewed: { '1': hashAnswerKeyForTest('a') },
      })
    );
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

  it('launches a reviewed test draft with the v2 universal window', async () => {
    const response = await POST(
      createRequest({
        eventId: EVENT_ID,
        maxAttempts: 10,
        mode: 'test',
        rulesVersion: QUIZ_TEST_RULES_VERSION,
        timePerQuestionSeconds: 10,
        timeZone: 'Africa/Lagos',
        timing: { kind: 'immediate', liveWindowSeconds: 300 },
        variantsPerQuestion: 1,
      })
    );

    expect(response.status).toBe(200);
    expect(mockQuizEventUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        contract_version: 2,
        live_window_seconds: 300,
        maximum_play_seconds: 10,
        mode: 'test',
        question_count: 1,
        rules_version: QUIZ_TEST_RULES_VERSION,
        status: 'active',
        time_per_question_seconds: 10,
      })
    );
  });

  it('launches a reviewed live prize through the atomic reservation RPC', async () => {
    mockRpc
      .mockResolvedValueOnce({ data: true, error: null })
      .mockResolvedValueOnce({
        data: {
          id: EVENT_ID,
          slug: 'daily-phone-quiz',
          status: 'active',
          title: 'Daily Phone Quiz',
        },
        error: null,
      });
    const response = await POST(
      createRequest({
        eventId: EVENT_ID,
        maxAttempts: 1,
        mode: 'live',
        regulatoryCompliance: {
          basis: 'free_skill_competition',
          evidenceReference: 'Free-entry rules and counsel note 2026-08',
          jurisdiction: 'NG-LA',
        },
        rulesVersion: QUIZ_LIVE_RULES_VERSION,
        timePerQuestionSeconds: 10,
        timeZone: 'Africa/Lagos',
        timing: { kind: 'immediate', liveWindowSeconds: 60 },
        variantsPerQuestion: 3,
      })
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      event: { id: EVENT_ID, status: 'active' },
    });
    expect(mockRpc).toHaveBeenCalledWith(
      'launch_quiz_event_v2',
      expect.objectContaining({
        p_event_id: EVENT_ID,
        p_regulatory_basis: 'free_skill_competition',
        p_regulatory_jurisdiction: 'NG-LA',
      })
    );
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('returns a previously launched v2 event when the admin retries after a lost response', async () => {
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
    mockActiveLookupMaybeSingle.mockResolvedValueOnce({
      data: {
        id: EVENT_ID,
        slug: 'daily-phone-quiz',
        status: 'scheduled',
        title: 'Daily Phone Quiz',
      },
      error: null,
    });

    const response = await POST(
      createRequest({
        eventId: EVENT_ID,
        maxAttempts: 10,
        mode: 'test',
        rulesVersion: QUIZ_TEST_RULES_VERSION,
        timePerQuestionSeconds: 10,
        timeZone: 'Africa/Lagos',
        timing: {
          endsAt: '2026-08-06T09:05:00.000Z',
          kind: 'scheduled',
          startsAt: '2026-08-06T09:00:00.000Z',
        },
        variantsPerQuestion: 1,
      })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      event: { id: EVENT_ID, status: 'scheduled' },
    });
    expect(mockActiveEqThird).toHaveBeenCalledWith('contract_version', 2);
    expect(mockActiveStatusIn).toHaveBeenCalledWith('status', [
      'active',
      'scheduled',
    ]);
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });

  it('rejects activation when the reviewed answer key does not match the stored draft', async () => {
    // The RPC reports the review was not recorded (a mismatch), and the draft
    // still carries no reviewed marker, so activateMerchantQuizDraft's preflight
    // refuses to open it.
    mockRpc.mockResolvedValueOnce({ data: false, error: null });
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

  it('returns 401 when the request is not authenticated', async () => {
    // authorizeMerchantQuizRequest short-circuits to 401 before any CSRF,
    // permission, or DB work when the session is missing/invalid.
    mockAuthenticateApiRequest.mockResolvedValue({
      error: { message: 'No session' },
      supabase: null,
      user: null,
    });

    const response = await POST(createRequest({ eventId: EVENT_ID }));

    expect(response.status).toBe(401);
    expect(mockRpc).not.toHaveBeenCalled();
    expect(mockQuizEventUpdate).not.toHaveBeenCalled();
  });
});
