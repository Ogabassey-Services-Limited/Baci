import { describe, expect, it, vi } from 'vitest';

import { runQuizFinalizationCli } from './process-quiz-finalization';

describe('process-quiz-finalization', () => {
  it('runs the shared finalizer directly without CRON_SECRET', async () => {
    const runJob = vi.fn().mockResolvedValue({
      body: {
        closed: 2,
        details: 'database-internal-detail',
        finalized: 1,
      },
      status: 200,
    });
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runQuizFinalizationCli({
        env: {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
          NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
          QUIZ_PHASE: 'production',
          QUIZ_PRODUCTION_APPROVED: 'true',
          QUIZ_DEVICE_HASH_PEPPER: 'x'.repeat(32),
          QUIZ_RPC_SERVER_SECRET: 'rpc-secret',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        },
        logger,
        runJob,
      })
    ).resolves.toBe(0);

    expect(runJob).toHaveBeenCalledWith();
    expect(logger.info).toHaveBeenCalledWith(
      '[quiz-finalization] completed',
      JSON.stringify({ closed: 2, finalized: 1, status: 200 })
    );
    expect(logger.info).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.stringContaining('database-internal-detail')
    );
  });

  it('returns a failing exit code without exposing the operational error', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runQuizFinalizationCli({
        env: {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
          NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
          QUIZ_PHASE: '1a',
          QUIZ_PRODUCTION_APPROVED: 'false',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        },
        logger,
        runJob: vi.fn().mockRejectedValue(new Error('secret provider failure')),
      })
    ).resolves.toBe(1);

    expect(logger.error).toHaveBeenCalledWith('[quiz-finalization] failed');
  });

  it('fails closed before work when the quiz launch gate is absent', async () => {
    const runJob = vi.fn();
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runQuizFinalizationCli({
        env: {
          NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
          NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
          QUIZ_PHASE: 'production',
          SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
        },
        logger,
        runJob,
      })
    ).resolves.toBe(1);

    expect(runJob).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      '[quiz-finalization] preflight failed'
    );
  });
});
