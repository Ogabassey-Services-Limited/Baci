import { NextRequest, NextResponse } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

const USER_ID = 'user-1';
const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const ATTEMPT_ID = '22222222-2222-2222-2222-222222222222';
const QUESTION_ID = '33333333-3333-3333-3333-333333333333';
const AWARD_ID = '44444444-4444-4444-4444-444444444444';
const ORIGINAL_QUIZ_ENV = {
  QUIZ_PHASE: process.env.QUIZ_PHASE,
  QUIZ_PRODUCTION_APPROVED: process.env.QUIZ_PRODUCTION_APPROVED,
  QUIZ_RPC_SERVER_SECRET: process.env.QUIZ_RPC_SERVER_SECRET,
};

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function mockSupabase() {
  const rpc = vi.fn().mockResolvedValue({ data: null, error: null });
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn().mockResolvedValue({
      data: { compliance_verified: true, nlrc_permit_ref: 'NLRC-1' },
      error: null,
    }),
    select: vi.fn(() => queryBuilder),
    single: vi.fn().mockResolvedValue({
      data: { compliance_verified: true, nlrc_permit_ref: 'NLRC-1' },
      error: null,
    }),
  };
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: USER_ID } },
        error: null,
      }),
    },
    from: vi.fn(() => queryBuilder),
    rpc,
  };
  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { rpc };
}

async function expectCsrfBlocksMutation(
  loadRoute: () => Promise<{ POST: unknown }>,
  request: NextRequest,
  context?: { params: Promise<{ attemptId: string }> }
) {
  const csrfResponse = NextResponse.json(
    { error: 'Invalid CSRF token' },
    { status: 403 }
  );
  vi.mocked(checkCsrfProtection).mockResolvedValue({
    response: csrfResponse,
    valid: false,
  });
  const { rpc } = mockSupabase();

  const { POST } = await loadRoute();
  const response = context
    ? await (
        POST as (
          request: NextRequest,
          context: { params: Promise<{ attemptId: string }> }
        ) => Promise<Response>
      )(request, context)
    : await (POST as (request: NextRequest) => Promise<Response>)(request);

  expect(response.status).toBe(403);
  expect(await response.json()).toEqual({ error: 'Invalid CSRF token' });
  expect(checkCsrfProtection).toHaveBeenCalledWith(request);
  expect(rpc).not.toHaveBeenCalled();
}

describe('quiz mutation CSRF contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUIZ_PHASE = 'production';
    process.env.QUIZ_PRODUCTION_APPROVED = 'true';
    process.env.QUIZ_RPC_SERVER_SECRET = 'test-secret';
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(ORIGINAL_QUIZ_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('blocks start attempt mutations when csrf validation fails', async () => {
    await expectCsrfBlocksMutation(
      () => import('./attempts/start/route'),
      jsonRequest('http://localhost/api/quiz/attempts/start', {
        eventId: EVENT_ID,
        integrityTier: 'device',
      })
    );
  });

  it('blocks answer submissions when csrf validation fails', async () => {
    await expectCsrfBlocksMutation(
      () => import('./attempts/[attemptId]/answers/route'),
      jsonRequest(`http://localhost/api/quiz/attempts/${ATTEMPT_ID}/answers`, {
        answer: 'A',
        clientAnsweredAt: '2026-05-16T10:00:00.000Z',
        integrityTier: 'strong',
        questionId: QUESTION_ID,
      }),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );
  });

  it('blocks award finalization when csrf validation fails', async () => {
    await expectCsrfBlocksMutation(
      () => import('./attempts/[attemptId]/finalize-awards/route'),
      jsonRequest(
        `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/finalize-awards`,
        { eventId: EVENT_ID }
      ),
      { params: Promise.resolve({ attemptId: ATTEMPT_ID }) }
    );
  });

  it('blocks grand prize claims when csrf validation fails', async () => {
    await expectCsrfBlocksMutation(
      () => import('./prizes/grand/claim/route'),
      jsonRequest('http://localhost/api/quiz/prizes/grand/claim', {
        eventId: EVENT_ID,
      })
    );
  });

  it('blocks cash award claims when csrf validation fails', async () => {
    await expectCsrfBlocksMutation(
      () => import('./awards/cash/claim/route'),
      jsonRequest('http://localhost/api/quiz/awards/cash/claim', {
        awardId: AWARD_ID,
      })
    );
  });
});
