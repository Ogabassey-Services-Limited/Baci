import { NextRequest } from 'next/server';
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
const EVENT_ID = '11111111-1111-4111-8111-111111111111';
const ATTEMPT_ID = '22222222-2222-4222-8222-222222222222';
const QUESTION_ID = '33333333-3333-4333-8333-333333333333';
const AWARD_ID = '44444444-4444-4444-8444-444444444444';
const originalQuizEnv = {
  QUIZ_PHASE: process.env.QUIZ_PHASE,
  QUIZ_PRODUCTION_APPROVED: process.env.QUIZ_PRODUCTION_APPROVED,
  QUIZ_RPC_SERVER_SECRET: process.env.QUIZ_RPC_SERVER_SECRET,
};

type AttemptContext = { params: Promise<{ attemptId: string }> };
type RouteCase = {
  context?: AttemptContext;
  loadRoute: () => Promise<{ POST: unknown }>;
  request: NextRequest;
};

function jsonRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function mockSupabase({
  rpcResult = { data: null, error: null },
  selectResult = {
    data: {
      compliance_verified: true,
      date_of_birth: '1990-01-01',
      event_id: EVENT_ID,
      merchant_id: 'merchant-1',
      nlrc_permit_ref: 'NLRC-1',
      quiz_events: { compliance_verified: true, nlrc_permit_ref: 'NLRC-1' },
    },
    error: null,
  },
  user = { id: USER_ID },
}: {
  rpcResult?: { data: unknown; error: unknown };
  selectResult?: { data: unknown; error: unknown };
  user?: { id: string } | null;
} = {}) {
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const queryBuilder = {
    eq: vi.fn(() => queryBuilder),
    limit: vi.fn(() => queryBuilder),
    maybeSingle: vi.fn().mockResolvedValue(selectResult),
    order: vi.fn(() => queryBuilder),
    select: vi.fn(() => queryBuilder),
    single: vi.fn().mockResolvedValue(selectResult),
  };
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from: vi.fn(() => queryBuilder),
    rpc,
  };

  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { rpc };
}

async function invokePost({ context, loadRoute, request }: RouteCase) {
  const { POST } = await loadRoute();
  if (context) {
    return (
      POST as (
        request: NextRequest,
        context: AttemptContext
      ) => Promise<Response>
    )(request, context);
  }
  return (POST as (request: NextRequest) => Promise<Response>)(request);
}

function routeCases(): RouteCase[] {
  return [
    {
      loadRoute: () => import('./attempts/start/route'),
      request: jsonRequest('http://localhost/api/quiz/attempts/start', {
        eventId: EVENT_ID,
        integrityTier: 'device',
      }),
    },
    {
      context: { params: Promise.resolve({ attemptId: ATTEMPT_ID }) },
      loadRoute: () => import('./attempts/[attemptId]/answers/route'),
      request: jsonRequest(
        `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/answers`,
        {
          answer: 'A',
          clientAnsweredAt: '2026-05-16T10:00:00.000Z',
          integrityTier: 'strong',
          questionId: QUESTION_ID,
        }
      ),
    },
    {
      context: { params: Promise.resolve({ attemptId: ATTEMPT_ID }) },
      loadRoute: () => import('./attempts/[attemptId]/finalize-awards/route'),
      request: jsonRequest(
        `http://localhost/api/quiz/attempts/${ATTEMPT_ID}/finalize-awards`,
        { eventId: EVENT_ID }
      ),
    },
    {
      loadRoute: () => import('./prizes/grand/claim/route'),
      request: jsonRequest('http://localhost/api/quiz/prizes/grand/claim', {
        eventId: EVENT_ID,
      }),
    },
    {
      loadRoute: () => import('./awards/cash/claim/route'),
      request: jsonRequest('http://localhost/api/quiz/awards/cash/claim', {
        awardId: AWARD_ID,
      }),
    },
  ];
}

describe('quiz route failure contracts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUIZ_PHASE = 'production';
    process.env.QUIZ_PRODUCTION_APPROVED = 'true';
    process.env.QUIZ_RPC_SERVER_SECRET = 'test-secret';
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const [key, value] of Object.entries(originalQuizEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it.each(
    routeCases()
  )('returns 401 before RPC when auth is missing', async (routeCase) => {
    const { rpc } = mockSupabase({ user: null });

    const response = await invokePost(routeCase);

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it.each(
    routeCases()
  )('returns 500 when the route RPC fails', async (routeCase) => {
    const { rpc } = mockSupabase({
      rpcResult: { data: null, error: { message: 'RPC failed' } },
    });

    const response = await invokePost(routeCase);

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Quiz request failed' });
    expect(rpc).toHaveBeenCalled();
  });
});
