import { EXAM_PASS_POINTS_COST } from '@baci/shared/constants';
import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { checkCsrfProtection } from '@/lib/csrf';
import { logger } from '@/lib/logger';
import { createClient } from '@/lib/supabase/server';

vi.mock('@/lib/csrf', () => ({
  checkCsrfProtection: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/logger', () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

const EVENT_ID = '11111111-1111-1111-1111-111111111111';
const USER_ID = 'user-1';
const ORIGINAL_QUIZ_ENV = {
  QUIZ_PHASE: process.env.QUIZ_PHASE,
  QUIZ_PRODUCTION_APPROVED: process.env.QUIZ_PRODUCTION_APPROVED,
  QUIZ_RPC_SERVER_SECRET: process.env.QUIZ_RPC_SERVER_SECRET,
};

function jsonRequest(body: unknown) {
  return new NextRequest('http://localhost/api/quiz/attempts/start', {
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
    method: 'POST',
  });
}

function mockAuthenticatedSupabase({
  eventGuardResult = {
    data: { compliance_verified: true, nlrc_permit_ref: 'NLRC-123' },
    error: null,
  },
  rpcResult = {
    data: {
      attemptId: 'attempt-1',
      eventId: EVENT_ID,
      examPassPointsSpent: EXAM_PASS_POINTS_COST,
      remainingLoyaltyPoints: 4,
    },
    error: null,
  },
  user = { id: USER_ID },
}: {
  eventGuardResult?: { data: unknown; error: unknown };
  rpcResult?: { data: unknown; error: unknown };
  user?: { id: string } | null;
} = {}) {
  const eventGuardBuilder = {
    eq: vi.fn(() => eventGuardBuilder),
    maybeSingle: vi.fn().mockResolvedValue(eventGuardResult),
    select: vi.fn(() => eventGuardBuilder),
  };
  const from = vi.fn((table: string) => {
    if (table === 'quiz_events') return eventGuardBuilder;
    return eventGuardBuilder;
  });
  const rpc = vi.fn().mockResolvedValue(rpcResult);
  const supabase = {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: null,
      }),
    },
    from,
    rpc,
  };

  vi.mocked(createClient).mockResolvedValue(supabase as never);
  return { eventGuardBuilder, from, rpc };
}

describe('start quiz attempt route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.QUIZ_RPC_SERVER_SECRET = 'test-secret';
    vi.mocked(checkCsrfProtection).mockResolvedValue({ valid: true });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    for (const [key, value] of Object.entries(ORIGINAL_QUIZ_ENV)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('returns 401 before RPC calls when authentication is missing', async () => {
    const { rpc } = mockAuthenticatedSupabase({ user: null });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID, integrityTier: 'device' })
    );

    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Unauthorized' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('returns 403 before RPC calls when CSRF validation fails', async () => {
    const { rpc } = mockAuthenticatedSupabase();
    vi.mocked(checkCsrfProtection).mockResolvedValueOnce({ valid: false });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID, integrityTier: 'device' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      error: 'CSRF validation failed',
    });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('validates input before calling the start RPC', async () => {
    const { rpc } = mockAuthenticatedSupabase();

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: 'not-a-uuid', integrityTier: 'device' })
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({ error: 'Invalid input' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('passes validated mobile input through the start RPC', async () => {
    const { rpc } = mockAuthenticatedSupabase();

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID, integrityTier: 'device' })
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      attemptId: 'attempt-1',
      eventId: EVENT_ID,
      examPassPointsSpent: EXAM_PASS_POINTS_COST,
      remainingLoyaltyPoints: 4,
    });
    expect(rpc).toHaveBeenCalledWith(
      'start_quiz_attempt',
      expect.objectContaining({
        p_event_id: EVENT_ID,
        p_integrity_tier: 'device',
        p_user_id: USER_ID,
      })
    );
  });

  it('returns 500 when the start RPC fails', async () => {
    const { rpc } = mockAuthenticatedSupabase({
      rpcResult: { data: null, error: { message: 'RPC failed' } },
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID, integrityTier: 'device' })
    );

    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Quiz request failed' });
    expect(rpc).toHaveBeenCalledWith(
      'start_quiz_attempt',
      expect.objectContaining({
        p_event_id: EVENT_ID,
        p_integrity_tier: 'device',
        p_user_id: USER_ID,
      })
    );
    expect(logger.error).toHaveBeenCalledWith({
      error: { message: 'RPC failed' },
      event: 'start_quiz_attempt',
      eventId: EVENT_ID,
      message: 'start_quiz_attempt RPC failed',
      userId: USER_ID,
    });
  });

  it('returns 409 when the customer does not have an exam pass point', async () => {
    const { rpc } = mockAuthenticatedSupabase({
      rpcResult: {
        data: null,
        error: { code: 'QZ011', message: 'quiz_exam_pass_required' },
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID, integrityTier: 'device' })
    );

    expect(response.status).toBe(409);
    const pointLabel = `${EXAM_PASS_POINTS_COST} loyalty ${
      EXAM_PASS_POINTS_COST === 1 ? 'point' : 'points'
    }`;
    expect(await response.json()).toEqual({
      code: 'QUIZ_EXAM_PASS_REQUIRED',
      error: `You need ${pointLabel} to start this exam`,
    });
    expect(rpc).toHaveBeenCalledWith(
      'start_quiz_attempt',
      expect.objectContaining({
        p_event_id: EVENT_ID,
        p_integrity_tier: 'device',
        p_user_id: USER_ID,
      })
    );
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('fails closed before starting prize play in production when permit evidence is missing', async () => {
    vi.stubEnv('QUIZ_PHASE', 'production');
    vi.stubEnv('QUIZ_PRODUCTION_APPROVED', 'true');
    const { eventGuardBuilder, from, rpc } = mockAuthenticatedSupabase({
      eventGuardResult: {
        data: { compliance_verified: true, nlrc_permit_ref: '   ' },
        error: null,
      },
    });

    const { POST } = await import('./route');
    const response = await POST(
      jsonRequest({ eventId: EVENT_ID, integrityTier: 'device' })
    );

    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({
      code: 'quiz_production_not_approved',
      error: 'Quiz prizes are not approved for production use',
    });
    expect(from).toHaveBeenCalledWith('quiz_events');
    expect(eventGuardBuilder.select).toHaveBeenCalledWith(
      'nlrc_permit_ref, compliance_verified'
    );
    expect(eventGuardBuilder.eq).toHaveBeenCalledWith('id', EVENT_ID);
    expect(rpc).not.toHaveBeenCalled();
  });
});
