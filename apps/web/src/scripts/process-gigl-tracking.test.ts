import { describe, expect, it, vi } from 'vitest';
import { runGiglTrackingCli } from './process-gigl-tracking';

const configuredEnv = {
  GIGL_BASE_URL: 'https://gigl.example.com',
  GIGL_EMAIL: 'worker@example.com',
  GIGL_PASSWORD: 'provider-password',
  GIGL_TRACKING_DATABASE_URL:
    'postgresql://gigl_tracking_worker.projectref:password@aws-1-eu-west-1.pooler.supabase.com:5432/postgres',
  NEXT_PUBLIC_SUPABASE_URL: 'https://projectref.supabase.co',
};

describe('process-gigl-tracking', () => {
  it('runs the monitor batch directly and logs only bounded counts', async () => {
    const runBatch = vi.fn().mockResolvedValue({
      ok: true,
      summary: {
        applied: 2,
        claimed: 3,
        failed: 1,
        paused: 0,
        providerPayload: 'must-not-be-logged',
        success: true,
      },
    });
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingCli({ env: configuredEnv, logger, runBatch })
    ).resolves.toBe(0);

    expect(runBatch).toHaveBeenCalledWith({ batchSize: 25 });
    expect(logger.info).toHaveBeenCalledWith(
      '[gigl-tracking] completed',
      JSON.stringify({
        applied: 2,
        claimed: 3,
        failed: 1,
        paused: 0,
        success: true,
      })
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'must-not-be-logged'
    );
  });

  it('fails closed before work when a provider variable is missing', async () => {
    const runBatch = vi.fn();
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingCli({
        env: { ...configuredEnv, GIGL_BASE_URL: '' },
        logger,
        runBatch,
      })
    ).resolves.toBe(1);

    expect(runBatch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      '[gigl-tracking] preflight failed'
    );
  });

  it('preserves the explicit GIGL disable switch without claiming work', async () => {
    const runBatch = vi.fn();
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingCli({
        env: { ...configuredEnv, GIGL_ENABLED: 'false' },
        logger,
        runBatch,
      })
    ).resolves.toBe(0);

    expect(runBatch).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith(
      '[gigl-tracking] completed',
      JSON.stringify({
        applied: 0,
        claimed: 0,
        failed: 0,
        paused: 0,
        success: true,
      })
    );
  });

  it('returns a failing exit code without exposing worker errors', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingCli({
        env: configuredEnv,
        logger,
        runBatch: vi
          .fn()
          .mockRejectedValue(new Error('provider credential leaked here')),
      })
    ).resolves.toBe(1);

    expect(logger.error).toHaveBeenCalledWith('[gigl-tracking] failed');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'provider credential leaked here'
    );
  });

  it('fails generically when the monitor batch returns a bounded failure', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingCli({
        env: configuredEnv,
        logger,
        runBatch: vi.fn().mockResolvedValue({
          ok: false,
          reason: 'claim_failed',
        }),
      })
    ).resolves.toBe(1);

    expect(logger.error).toHaveBeenCalledWith('[gigl-tracking] failed');
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'claim_failed'
    );
  });

  it('keeps the terminal failure message when the default console logger is suppressed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(
        runGiglTrackingCli({
          env: configuredEnv,
          runBatch: vi.fn().mockRejectedValue(new Error('provider failure')),
        })
      ).resolves.toBe(1);

      expect(error).toHaveBeenCalledWith('[gigl-tracking] failed');
    } finally {
      error.mockRestore();
    }
  });
});
