import { describe, expect, it, vi } from 'vitest';
import { runGiglTrackingNotificationsCli } from './process-gigl-tracking-notifications';

const configuredEnv = {
  EXPO_ACCESS_TOKEN: 'expo-token',
  NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
  NEXT_PUBLIC_SUPABASE_URL: 'https://project.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
  ZEPTOMAIL_TOKEN: 'zeptomail-token',
};

describe('process-gigl-tracking-notifications', () => {
  it('runs the notification batch directly and logs only bounded counts', async () => {
    const runBatch = vi.fn().mockResolvedValue({
      ok: true,
      summary: {
        claimed: 4,
        customerEmail: 'customer@example.com',
        failed: 1,
        sent: 2,
        skipped: 1,
        success: true,
      },
    });
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingNotificationsCli({
        env: configuredEnv,
        logger,
        runBatch,
      })
    ).resolves.toBe(0);

    expect(runBatch).toHaveBeenCalledWith({ batchSize: 10 });
    expect(logger.info).toHaveBeenCalledWith(
      '[gigl-tracking-notifications] completed',
      JSON.stringify({
        claimed: 4,
        failed: 1,
        sent: 2,
        skipped: 1,
        success: true,
      })
    );
    expect(JSON.stringify(logger.info.mock.calls)).not.toContain(
      'customer@example.com'
    );
  });

  it('fails closed before work when a notification credential is missing', async () => {
    const runBatch = vi.fn();
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingNotificationsCli({
        env: { ...configuredEnv, EXPO_ACCESS_TOKEN: '' },
        logger,
        runBatch,
      })
    ).resolves.toBe(1);

    expect(runBatch).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      '[gigl-tracking-notifications] preflight failed'
    );
  });

  it('returns a failing exit code without exposing worker errors', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingNotificationsCli({
        env: configuredEnv,
        logger,
        runBatch: vi
          .fn()
          .mockRejectedValue(new Error('customer-linked provider failure')),
      })
    ).resolves.toBe(1);

    expect(logger.error).toHaveBeenCalledWith(
      '[gigl-tracking-notifications] failed'
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'customer-linked provider failure'
    );
  });

  it('fails generically when the notification batch returns a bounded failure', async () => {
    const logger = { error: vi.fn(), info: vi.fn() };

    await expect(
      runGiglTrackingNotificationsCli({
        env: configuredEnv,
        logger,
        runBatch: vi.fn().mockResolvedValue({
          ok: false,
          reason: 'claim_failed',
        }),
      })
    ).resolves.toBe(1);

    expect(logger.error).toHaveBeenCalledWith(
      '[gigl-tracking-notifications] failed'
    );
    expect(JSON.stringify(logger.error.mock.calls)).not.toContain(
      'claim_failed'
    );
  });

  it('keeps the terminal failure message when the default console logger is suppressed', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    try {
      await expect(
        runGiglTrackingNotificationsCli({
          env: configuredEnv,
          runBatch: vi.fn().mockRejectedValue(new Error('provider failure')),
        })
      ).resolves.toBe(1);

      expect(error).toHaveBeenCalledWith(
        '[gigl-tracking-notifications] failed'
      );
    } finally {
      error.mockRestore();
    }
  });
});
