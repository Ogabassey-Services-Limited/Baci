import { afterEach, describe, expect, it, vi } from 'vitest';

describe('GIGL tracking constants', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('uses the configured batch timeout only when it is within the safe bound', async () => {
    vi.stubEnv('GIGL_TRACKING_BATCH_TIMEOUT_MS', '45000');
    const constants = await import('./gigl.tracking-constants');

    expect(constants.GIGL_TRACKING_BATCH_TIMEOUT_MS).toBe(45_000);
  });

  it('reserves cron cleanup headroom by rejecting the full function duration', async () => {
    vi.stubEnv('GIGL_TRACKING_BATCH_TIMEOUT_MS', '60000');
    const constants = await import('./gigl.tracking-constants');

    expect(constants.GIGL_TRACKING_BATCH_TIMEOUT_MS).toBe(15_000);
  });

  it('shares bounded positive environment parsing with provider constants', async () => {
    const { readPositiveIntegerEnv } = await import(
      './gigl.tracking-constants'
    );

    expect(readPositiveIntegerEnv('10', 10)).toBe(10);
    expect(readPositiveIntegerEnv('0', 10)).toBeUndefined();
    expect(readPositiveIntegerEnv('11', 10)).toBeUndefined();
  });
});
