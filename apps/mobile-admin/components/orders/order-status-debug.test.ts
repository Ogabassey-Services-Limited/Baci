import { afterEach, describe, expect, it, vi } from 'vitest';
import { logOrderStatusDebug } from './order-status-debug';

describe('logOrderStatusDebug', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('writes status drawer diagnostics in development builds', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logOrderStatusDebug('footer-button-pressed', {
      currentStatusLabel: 'Processing',
    });

    expect(logSpy).toHaveBeenCalledWith('[OrderStatusDebug]', {
      currentStatusLabel: 'Processing',
      event: 'footer-button-pressed',
    });
  });

  it('keeps diagnostics quiet during automated tests', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logOrderStatusDebug('footer-button-pressed');

    expect(logSpy).not.toHaveBeenCalled();
  });
});
