import { beforeEach, describe, expect, it, vi } from 'vitest';
import { logger } from '@/lib/logger';

const mocks = vi.hoisted(() => ({
  approved: vi.fn(() => false),
  phase: vi.fn(() => '1a'),
  rpc: vi.fn(),
}));
vi.mock('@/lib/quiz/quiz-runtime-env', () => ({
  getQuizPhaseEnv: mocks.phase,
  getQuizProductionApprovedEnv: mocks.approved,
}));
vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ rpc: mocks.rpc }),
}));
vi.mock('@/lib/logger', () => ({
  logger: { error: vi.fn() },
}));

import { finalizeDueQuizEvents } from './finalize-due-quiz-events';

describe('finalizeDueQuizEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.phase.mockReturnValue('1a');
    mocks.approved.mockReturnValue(false);
    mocks.rpc.mockResolvedValue({ data: {}, error: null });
  });

  it('always promotes, closes tests, terminalizes live attempts, and expires old awards', async () => {
    mocks.rpc
      .mockResolvedValueOnce({ data: 2, error: null })
      .mockResolvedValueOnce({
        data: { testClosed: 3, zeroPlayerClosed: 1 },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { liveTerminalized: 4, zeroPlayerClosed: 2 },
        error: null,
      })
      .mockResolvedValueOnce({ data: { expired: 1, released: 1 }, error: null })
      .mockResolvedValueOnce({ data: { liveAwaitingGate: 4 }, error: null });

    const result = await finalizeDueQuizEvents();

    expect(mocks.rpc.mock.calls.map(([name]) => name)).toEqual([
      'promote_due_scheduled_quiz_events_service_v2',
      'finalize_due_test_quiz_events_v2',
      'terminalize_due_live_quiz_events_v2',
      'expire_unclaimed_ranked_quiz_awards_v2',
      'finalize_due_live_quiz_events_v2',
      'close_due_product_quiz_events',
    ]);
    expect(result.body).toMatchObject({
      scheduledPromoted: 2,
      testClosed: 3,
      zeroPlayerClosed: 3,
      liveTerminalized: 4,
      liveAwaitingGate: 4,
      expired: 1,
      released: 1,
      skippedLive: 4,
      failed: 0,
    });
  });

  it('passes both production gates to the live database finalizer', async () => {
    mocks.phase.mockReturnValue('production');
    mocks.approved.mockReturnValue(true);
    await finalizeDueQuizEvents();
    expect(mocks.rpc).toHaveBeenLastCalledWith('finalize_due_quiz_events');
    expect(mocks.rpc).toHaveBeenCalledWith('finalize_due_live_quiz_events_v2', {
      p_production_approved: true,
      p_production_phase: true,
    });
  });

  it('runs independent steps after a failure and redacts all database values', async () => {
    mocks.rpc.mockResolvedValueOnce({
      data: null,
      error: {
        code: 'P0001',
        details: 'Failing row contains (customer@example.com, sk_live_secret)',
        hint: 'token=private-token',
        message: `customer@example.com token=private-token ${'x'.repeat(300)}`,
      },
    });
    const result = await finalizeDueQuizEvents();
    expect(result.status).toBe(500);
    expect(result.body).toMatchObject({
      code: 'QUIZ_FINALIZATION_FAILED',
      failed: 1,
    });
    expect(JSON.stringify(result.body)).not.toContain('customer@example.com');
    expect(mocks.rpc).toHaveBeenCalledTimes(6);
    expect(logger.error).toHaveBeenCalledWith({
      code: 'P0001',
      error: '[REDACTED]',
      message: 'Quiz finalization RPC failed',
      rpc: 'promote_due_scheduled_quiz_events_service_v2',
    });
    const logged = JSON.stringify(vi.mocked(logger.error).mock.calls);
    expect(logged).not.toContain('customer@example.com');
    expect(logged).not.toContain('private-token');
    expect(logged).not.toContain('sk_live_secret');
  });
});
